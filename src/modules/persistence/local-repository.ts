import { z } from "zod";
import {
  configurationSpecSchema,
  telescopeConfigurationSchema,
  type ConfigurationSpec,
  type TelescopeConfiguration,
} from "@/modules/configurations/models";
import {
  accessoryInputSchema,
  accessorySchema,
  telescopeProfileInputSchema,
  telescopeProfileSchema,
  type Accessory,
  type TelescopeProfile,
  type TelescopeProfileInput,
} from "@/modules/equipment/models";
import {
  observationProjectInputSchema,
  observationProjectSchema,
  type ObservationProject,
} from "@/modules/projects/models";
import { simulationSessionSchema, type NewSession, type SimulationSession } from "@/modules/sessions/models";
import { NotFoundError, ValidationError, type ObservatoryRepository } from "./repository";

/**
 * Browser-storage implementation of ObservatoryRepository.
 *
 * Data lives in a single versioned JSON document in the user's own browser,
 * so it is private to this device by construction. Every write is validated;
 * every read is validated and corrupt documents are set aside, not crashed on.
 */

export interface KeyValueStore {
  get(key: string): string | null;
  set(key: string, value: string): void;
  /** Optional cross-tab change notification. */
  onExternalChange?(key: string, listener: () => void): () => void;
}

/** Storage key (unchanged across document schema versions so data is kept). */
export const STORAGE_KEY = "universal-observatory:v1";
const SCHEMA_VERSION = 2;

const documentSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  profiles: z.array(telescopeProfileSchema),
  accessories: z.array(accessorySchema),
  configurations: z.array(telescopeConfigurationSchema),
  sessions: z.array(simulationSessionSchema),
  projects: z.array(observationProjectSchema),
});

interface StoreDocument {
  schemaVersion: typeof SCHEMA_VERSION;
  profiles: TelescopeProfile[];
  accessories: Accessory[];
  configurations: TelescopeConfiguration[];
  sessions: SimulationSession[];
  projects: ObservationProject[];
}

const emptyDocument = (): StoreDocument => ({
  schemaVersion: SCHEMA_VERSION,
  profiles: [],
  accessories: [],
  configurations: [],
  sessions: [],
  projects: [],
});

/**
 * Bring older documents up to date. v1 → v2 adds accessories and projects;
 * profiles without a status are read as "owned" by the profile schema.
 */
function upgrade(raw: unknown): unknown {
  if (raw && typeof raw === "object" && (raw as { schemaVersion?: unknown }).schemaVersion === 1) {
    return { ...raw, schemaVersion: 2, accessories: [], projects: [] };
  }
  return raw;
}

function parseOrThrow<T>(schema: z.ZodType<T>, value: unknown): T {
  const r = schema.safeParse(value);
  if (!r.success) {
    throw new ValidationError(r.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })));
  }
  return r.data;
}

const clone = <T>(v: T): T => structuredClone(v);
const byNewest = <T extends { createdAt: string }>(a: T, b: T) => b.createdAt.localeCompare(a.createdAt);

export interface LocalRepositoryOptions {
  now?: () => Date;
  newId?: () => string;
  /** Called when stored data is unreadable and has been set aside. */
  onCorruptData?: (backupKey: string) => void;
}

export function createLocalRepository(store: KeyValueStore, opts: LocalRepositoryOptions = {}): ObservatoryRepository {
  const now = () => (opts.now?.() ?? new Date()).toISOString();
  const newId = opts.newId ?? (() => crypto.randomUUID());
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((l) => l());

  function load(): StoreDocument {
    const raw = store.get(STORAGE_KEY);
    if (!raw) return emptyDocument();
    try {
      // Session results and target snapshots are written verbatim by our own
      // code and only validated structurally (see simulationSessionSchema).
      return documentSchema.parse(upgrade(JSON.parse(raw))) as unknown as StoreDocument;
    } catch {
      const backupKey = `${STORAGE_KEY}:corrupt:${Date.now()}`;
      store.set(backupKey, raw);
      store.set(STORAGE_KEY, JSON.stringify(emptyDocument()));
      opts.onCorruptData?.(backupKey);
      return emptyDocument();
    }
  }

  function mutate<T>(fn: (doc: StoreDocument) => T): T {
    const doc = load();
    const out = fn(doc);
    store.set(STORAGE_KEY, JSON.stringify(doc));
    notify();
    return out;
  }

  function findIndex<T extends { id: string }>(items: T[], id: string, kind: string): number {
    const i = items.findIndex((x) => x.id === id);
    if (i < 0) throw new NotFoundError(kind, id);
    return i;
  }

  /** Configurations linked to a profile must mirror its optics. */
  function checkProfileLink(doc: StoreDocument, spec: ConfigurationSpec): ConfigurationSpec {
    if (!spec.profileId) return spec;
    const profile = doc.profiles.find((p) => p.id === spec.profileId);
    if (!profile) throw new ValidationError([{ path: "profileId", message: "Linked equipment profile does not exist" }]);
    return {
      ...spec,
      telescope: {
        apertureMm: profile.apertureMm,
        focalLengthMm: profile.focalLengthMm,
        opticalDesign: profile.opticalDesign,
        ...(spec.telescope.label ? { label: spec.telescope.label } : {}),
      },
    };
  }

  const repo: ObservatoryRepository = {
    async listProfiles() {
      return clone(load().profiles).sort(byNewest);
    },
    async getProfile(id) {
      return clone(load().profiles.find((p) => p.id === id));
    },
    async createProfile(input: TelescopeProfileInput) {
      const data = parseOrThrow(telescopeProfileInputSchema, input);
      return mutate((doc) => {
        const t = now();
        const profile: TelescopeProfile = { ...data, id: newId(), createdAt: t, updatedAt: t };
        doc.profiles.push(profile);
        return clone(profile);
      });
    },
    async updateProfile(id, input) {
      const data = parseOrThrow(telescopeProfileInputSchema, input);
      return mutate((doc) => {
        const i = findIndex(doc.profiles, id, "Profile");
        const t = now();
        const profile: TelescopeProfile = { ...doc.profiles[i], ...data, updatedAt: t };
        doc.profiles[i] = profile;
        doc.configurations = doc.configurations.map((c) => {
          if (c.profileId !== id) return c;
          const updated = checkProfileLink(doc, c);
          return JSON.stringify(updated.telescope) === JSON.stringify(c.telescope)
            ? c
            : { ...c, telescope: updated.telescope, version: c.version + 1, updatedAt: t };
        });
        return clone(profile);
      });
    },
    async deleteProfile(id) {
      mutate((doc) => {
        const i = findIndex(doc.profiles, id, "Profile");
        doc.profiles.splice(i, 1);
        doc.configurations = doc.configurations.map((c) => {
          if (c.profileId !== id) return c;
          const { profileId: _unlinked, ...rest } = c; // eslint-disable-line @typescript-eslint/no-unused-vars
          return rest;
        });
      });
    },

    async listAccessories() {
      return clone(load().accessories).sort(byNewest);
    },
    async createAccessory(input) {
      const data = parseOrThrow(accessoryInputSchema, input);
      return mutate((doc) => {
        const t = now();
        const accessory = { ...data, id: newId(), createdAt: t, updatedAt: t } as Accessory;
        doc.accessories.push(accessory);
        return clone(accessory);
      });
    },
    async updateAccessory(id, input) {
      const data = parseOrThrow(accessoryInputSchema, input);
      return mutate((doc) => {
        const i = findIndex(doc.accessories, id, "Accessory");
        const prev = doc.accessories[i];
        const accessory = { ...data, id, createdAt: prev.createdAt, updatedAt: now() } as Accessory;
        doc.accessories[i] = accessory;
        return clone(accessory);
      });
    },
    async deleteAccessory(id) {
      mutate((doc) => {
        doc.accessories.splice(findIndex(doc.accessories, id, "Accessory"), 1);
      });
    },

    async listConfigurations() {
      return clone(load().configurations).sort(byNewest);
    },
    async getConfiguration(id) {
      return clone(load().configurations.find((c) => c.id === id));
    },
    async createConfiguration(spec) {
      const data = parseOrThrow(configurationSpecSchema, spec) as ConfigurationSpec;
      return mutate((doc) => {
        const t = now();
        const config: TelescopeConfiguration = { ...checkProfileLink(doc, data), id: newId(), version: 1, createdAt: t, updatedAt: t };
        doc.configurations.push(config);
        return clone(config);
      });
    },
    async updateConfiguration(id, spec) {
      const data = parseOrThrow(configurationSpecSchema, spec) as ConfigurationSpec;
      return mutate((doc) => {
        const i = findIndex(doc.configurations, id, "Configuration");
        const prev = doc.configurations[i];
        const config: TelescopeConfiguration = {
          ...checkProfileLink(doc, data),
          id,
          version: prev.version + 1,
          createdAt: prev.createdAt,
          updatedAt: now(),
        };
        doc.configurations[i] = config;
        return clone(config);
      });
    },
    async duplicateConfiguration(id) {
      return mutate((doc) => {
        const source = doc.configurations[findIndex(doc.configurations, id, "Configuration")];
        const t = now();
        const copy: TelescopeConfiguration = {
          ...clone(source),
          id: newId(),
          name: `${source.name} (copy)`.slice(0, 100),
          version: 1,
          createdAt: t,
          updatedAt: t,
        };
        doc.configurations.push(copy);
        return clone(copy);
      });
    },
    async deleteConfiguration(id) {
      mutate((doc) => {
        doc.configurations.splice(findIndex(doc.configurations, id, "Configuration"), 1);
      });
    },

    async listSessions() {
      return clone(load().sessions).sort(byNewest);
    },
    async getSession(id) {
      return clone(load().sessions.find((s) => s.id === id));
    },
    async createSession(input: NewSession) {
      return mutate((doc) => {
        const session = { ...clone(input), id: newId(), createdAt: now() };
        parseOrThrow(simulationSessionSchema, session);
        doc.sessions.push(session);
        return clone(session);
      });
    },
    async deleteSession(id) {
      mutate((doc) => {
        doc.sessions.splice(findIndex(doc.sessions, id, "Session"), 1);
        doc.projects = doc.projects.map((p) =>
          p.sessionIds.includes(id) ? { ...p, sessionIds: p.sessionIds.filter((s) => s !== id) } : p,
        );
      });
    },

    async listProjects() {
      return clone(load().projects).sort(byNewest);
    },
    async getProject(id) {
      return clone(load().projects.find((p) => p.id === id));
    },
    async createProject(input) {
      const data = parseOrThrow(observationProjectInputSchema, input);
      return mutate((doc) => {
        const t = now();
        const project: ObservationProject = { ...data, id: newId(), sessionIds: [], createdAt: t, updatedAt: t };
        doc.projects.push(project);
        return clone(project);
      });
    },
    async updateProject(id, input) {
      const data = parseOrThrow(observationProjectInputSchema, input);
      return mutate((doc) => {
        const i = findIndex(doc.projects, id, "Project");
        const prev = doc.projects[i];
        const project: ObservationProject = { ...data, id, sessionIds: prev.sessionIds, createdAt: prev.createdAt, updatedAt: now() };
        doc.projects[i] = project;
        return clone(project);
      });
    },
    async deleteProject(id) {
      mutate((doc) => {
        doc.projects.splice(findIndex(doc.projects, id, "Project"), 1);
      });
    },
    async addSessionToProject(projectId, sessionId) {
      mutate((doc) => {
        const project = doc.projects[findIndex(doc.projects, projectId, "Project")];
        findIndex(doc.sessions, sessionId, "Session");
        if (!project.sessionIds.includes(sessionId)) project.sessionIds.push(sessionId);
      });
    },
    async removeSessionFromProject(projectId, sessionId) {
      mutate((doc) => {
        const project = doc.projects[findIndex(doc.projects, projectId, "Project")];
        project.sessionIds = project.sessionIds.filter((s) => s !== sessionId);
      });
    },

    subscribe(listener) {
      listeners.add(listener);
      const off = store.onExternalChange?.(STORAGE_KEY, listener);
      return () => {
        listeners.delete(listener);
        off?.();
      };
    },
  };
  return repo;
}

/** In-memory store for tests and non-browser environments. */
export function createMemoryStore(initial: Record<string, string> = {}): KeyValueStore & { dump(): Record<string, string> } {
  const data = new Map(Object.entries(initial));
  return {
    get: (k) => data.get(k) ?? null,
    set: (k, v) => void data.set(k, v),
    dump: () => Object.fromEntries(data),
  };
}

/** localStorage-backed store with cross-tab notifications. */
export function createBrowserStore(): KeyValueStore {
  return {
    get: (k) => window.localStorage.getItem(k),
    set: (k, v) => {
      try {
        window.localStorage.setItem(k, v);
      } catch (e) {
        throw new Error(
          e instanceof DOMException && e.name === "QuotaExceededError"
            ? "Browser storage is full. Delete some saved sessions and try again."
            : "Could not write to browser storage.",
        );
      }
    },
    onExternalChange: (key, listener) => {
      const handler = (e: StorageEvent) => {
        if (e.key === key) listener();
      };
      window.addEventListener("storage", handler);
      return () => window.removeEventListener("storage", handler);
    },
  };
}
