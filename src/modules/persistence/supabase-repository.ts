import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json, Tables } from "@/lib/supabase/database.types";
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
  type AccessoryInput,
  type TelescopeProfile,
  type TelescopeProfileInput,
} from "@/modules/equipment/models";
import {
  observationProjectInputSchema,
  observationProjectSchema,
  type ObservationProject,
  type ObservationProjectInput,
} from "@/modules/projects/models";
import { simulationSessionSchema, type NewSession, type SimulationSession } from "@/modules/sessions/models";
import { NotFoundError, ValidationError, type ObservatoryRepository } from "./repository";

/**
 * Supabase (Postgres) implementation of ObservatoryRepository.
 *
 * Runs with the signed-in user's session; row-level security in the database
 * enforces ownership, value ranges and session immutability (see
 * supabase/migrations). Inputs are also validated here for clear messages,
 * and rows are validated on read so one bad record cannot break a page.
 */

export class AuthRequiredError extends Error {
  constructor() {
    super("Sign in to save and view your observatory.");
    this.name = "AuthRequiredError";
  }
}

type Client = SupabaseClient<Database>;
type ProfileRow = Tables<"telescope_profiles">;
type AccessoryRow = Tables<"accessories">;
type ProjectRow = Tables<"observation_projects"> & {
  project_sessions: Pick<Tables<"project_sessions">, "session_id" | "added_at">[];
};
type ConfigurationRow = Tables<"telescope_configurations"> & {
  configuration_components: Pick<Tables<"configuration_components">, "component_type" | "spec">[];
};
type SessionRow = Tables<"simulation_sessions"> & {
  session_configurations: Tables<"session_configurations"> | Tables<"session_configurations">[] | null;
  simulation_results: Tables<"simulation_results"> | Tables<"simulation_results">[] | null;
};

const CONFIGURATION_SELECT = "*, configuration_components(component_type, spec)";
const SESSION_SELECT = "*, session_configurations(*), simulation_results(*)";
const PROJECT_SELECT = "*, project_sessions(session_id, added_at)";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const newSessionSchema = simulationSessionSchema.omit({ id: true, createdAt: true });

function validate<T>(schema: { safeParse(v: unknown): { success: true; data: T } | { success: false; error: { issues: { path: PropertyKey[]; message: string }[] } } }, value: unknown): T {
  const r = schema.safeParse(value);
  if (!r.success) {
    throw new ValidationError(r.error.issues.map((i) => ({ path: i.path.map(String).join("."), message: i.message })));
  }
  return r.data;
}

/** Map database errors to the repository's error types. */
function fail(error: PostgrestError, notFound?: () => NotFoundError, foreignKey?: () => Error): never {
  switch (error.code) {
    case "42501": // insufficient privilege: signed out
    case "PGRST301": // JWT invalid/expired
      throw new AuthRequiredError();
    case "P0002":
      throw notFound?.() ?? new Error(error.message);
    case "23503":
      if (foreignKey) throw foreignKey();
      throw new ValidationError([{ path: "profileId", message: "Linked equipment profile does not exist" }]);
    case "23502":
    case "23514":
    case "22P02":
    case "22003":
      throw new ValidationError([{ path: "", message: "One or more values are outside the allowed range." }]);
    default:
      throw new Error(error.message);
  }
}

function one<T>(v: T | T[] | null | undefined): T | undefined {
  return Array.isArray(v) ? v[0] : (v ?? undefined);
}

function warnInvalid(kind: string, id: string) {
  console.warn(`Skipping unreadable ${kind} record ${id}.`);
}

function profileFromRow(r: ProfileRow): TelescopeProfile | undefined {
  const parsed = telescopeProfileSchema.safeParse({
    id: r.id,
    name: r.name,
    opticalDesign: r.optical_design,
    apertureMm: r.aperture_mm,
    focalLengthMm: r.focal_length_mm,
    mountType: r.mount_type,
    status: r.status,
    ...(r.manufacturer ? { manufacturer: r.manufacturer } : {}),
    ...(r.model ? { model: r.model } : {}),
    ...(r.notes ? { notes: r.notes } : {}),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  });
  if (!parsed.success) return warnInvalid("profile", r.id), undefined;
  return parsed.data;
}

function configurationFromRow(r: ConfigurationRow): TelescopeConfiguration | undefined {
  const components = Object.fromEntries(r.configuration_components.map((c) => [c.component_type, c.spec]));
  const parsed = telescopeConfigurationSchema.safeParse({
    id: r.id,
    name: r.name,
    status: r.status,
    ...(r.profile_id ? { profileId: r.profile_id } : {}),
    ...(r.catalog_ref ? { catalogRef: r.catalog_ref } : {}),
    telescope: {
      apertureMm: r.aperture_mm,
      focalLengthMm: r.focal_length_mm,
      ...(r.optical_design ? { opticalDesign: r.optical_design } : {}),
      ...(r.telescope_label ? { label: r.telescope_label } : {}),
    },
    ...components,
    ...(r.notes ? { notes: r.notes } : {}),
    version: r.version,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  });
  if (!parsed.success) return warnInvalid("configuration", r.id), undefined;
  return parsed.data as TelescopeConfiguration;
}

function sessionFromRow(r: SessionRow): SimulationSession | undefined {
  const snap = one(r.session_configurations);
  const res = one(r.simulation_results);
  if (!snap || !res) return warnInvalid("session", r.id), undefined;
  const candidate = {
    id: r.id,
    createdAt: r.created_at,
    name: r.name,
    mode: r.mode,
    targetSnapshot: r.target_snapshot,
    conditions: r.conditions,
    ...(r.exposure ? { exposure: r.exposure } : {}),
    view: r.view_settings,
    ...(snap.configuration_id && snap.configuration_version
      ? {
          configurationRef: {
            id: snap.configuration_id,
            version: snap.configuration_version,
            modified: snap.modified_from_saved,
          },
        }
      : {}),
    configurationSnapshot: snap.snapshot,
    engineVersion: r.simulation_version,
    result: res.result,
  };
  if (!simulationSessionSchema.safeParse(candidate).success) return warnInvalid("session", r.id), undefined;
  // Snapshots and results are written verbatim by our own code; structure checked above.
  return candidate as unknown as SimulationSession;
}

function accessoryFromRow(r: AccessoryRow): Accessory | undefined {
  const parsed = accessorySchema.safeParse({
    id: r.id,
    kind: r.kind,
    name: r.name,
    status: r.status,
    ...(r.manufacturer ? { manufacturer: r.manufacturer } : {}),
    ...(r.model ? { model: r.model } : {}),
    ...(r.notes ? { notes: r.notes } : {}),
    spec: r.spec,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  });
  if (!parsed.success) return warnInvalid("accessory", r.id), undefined;
  return parsed.data as Accessory;
}

function projectFromRow(r: ProjectRow): ObservationProject | undefined {
  const parsed = observationProjectSchema.safeParse({
    id: r.id,
    name: r.name,
    ...(r.description ? { description: r.description } : {}),
    targetIds: r.target_ids,
    sessionIds: [...r.project_sessions].sort((a, b) => a.added_at.localeCompare(b.added_at)).map((s) => s.session_id),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  });
  if (!parsed.success) return warnInvalid("project", r.id), undefined;
  return parsed.data;
}

const defined = <T>(v: T | undefined): v is T => v !== undefined;

function accessoryColumns(input: AccessoryInput) {
  return {
    kind: input.kind,
    name: input.name,
    status: input.status,
    manufacturer: input.manufacturer ?? null,
    model: input.model ?? null,
    notes: input.notes ?? null,
    spec: input.spec as unknown as { [key: string]: Json },
  };
}

function projectColumns(input: ObservationProjectInput) {
  return { name: input.name, description: input.description ?? null, target_ids: input.targetIds };
}

function profileColumns(input: TelescopeProfileInput) {
  return {
    name: input.name,
    optical_design: input.opticalDesign,
    aperture_mm: input.apertureMm,
    focal_length_mm: input.focalLengthMm,
    mount_type: input.mountType,
    status: input.status,
    manufacturer: input.manufacturer ?? null,
    model: input.model ?? null,
    notes: input.notes ?? null,
  };
}

export function createSupabaseRepository(client: Client): ObservatoryRepository {
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((l) => l());
  // Data visible to the app changes when the signed-in user changes.
  client.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") notify();
  });

  async function fetchConfiguration(id: string): Promise<TelescopeConfiguration | undefined> {
    if (!UUID.test(id)) return undefined;
    const { data, error } = await client.from("telescope_configurations").select(CONFIGURATION_SELECT).eq("id", id).maybeSingle();
    if (error) fail(error);
    return data ? configurationFromRow(data as ConfigurationRow) : undefined;
  }

  async function fetchSession(id: string): Promise<SimulationSession | undefined> {
    if (!UUID.test(id)) return undefined;
    const { data, error } = await client.from("simulation_sessions").select(SESSION_SELECT).eq("id", id).maybeSingle();
    if (error) fail(error);
    return data ? sessionFromRow(data as unknown as SessionRow) : undefined;
  }

  async function mustFetchConfiguration(id: string): Promise<TelescopeConfiguration> {
    const c = await fetchConfiguration(id);
    if (!c) throw new NotFoundError("Configuration", id);
    return c;
  }

  async function fetchProject(id: string): Promise<ObservationProject | undefined> {
    if (!UUID.test(id)) return undefined;
    const { data, error } = await client.from("observation_projects").select(PROJECT_SELECT).eq("id", id).maybeSingle();
    if (error) fail(error);
    return data ? projectFromRow(data as ProjectRow) : undefined;
  }

  async function mustFetchProject(id: string): Promise<ObservationProject> {
    const p = await fetchProject(id);
    if (!p) throw new NotFoundError("Project", id);
    return p;
  }

  async function saveConfiguration(id: string | null, spec: ConfigurationSpec): Promise<TelescopeConfiguration> {
    const data = validate(configurationSpecSchema, spec);
    const { data: savedId, error } = await client.rpc("save_configuration", {
      p_id: id as string, // null creates a new configuration
      p_spec: data as unknown as Json,
    });
    if (error) fail(error, () => new NotFoundError("Configuration", id ?? ""));
    notify();
    return mustFetchConfiguration(savedId);
  }

  return {
    async listProfiles() {
      const { data, error } = await client.from("telescope_profiles").select("*").order("created_at", { ascending: false });
      if (error) fail(error);
      return data.map(profileFromRow).filter(defined);
    },
    async getProfile(id) {
      if (!UUID.test(id)) return undefined;
      const { data, error } = await client.from("telescope_profiles").select("*").eq("id", id).maybeSingle();
      if (error) fail(error);
      return data ? profileFromRow(data) : undefined;
    },
    async createProfile(input) {
      const data = validate(telescopeProfileInputSchema, input);
      const { data: row, error } = await client.from("telescope_profiles").insert(profileColumns(data)).select().single();
      if (error) fail(error);
      notify();
      return profileFromRow(row)!;
    },
    async updateProfile(id, input) {
      const data = validate(telescopeProfileInputSchema, input);
      if (!UUID.test(id)) throw new NotFoundError("Profile", id);
      const { data: row, error } = await client
        .from("telescope_profiles")
        .update(profileColumns(data))
        .eq("id", id)
        .select()
        .maybeSingle();
      if (error) fail(error);
      if (!row) throw new NotFoundError("Profile", id);
      notify();
      return profileFromRow(row)!;
    },
    async deleteProfile(id) {
      if (!UUID.test(id)) throw new NotFoundError("Profile", id);
      const { data, error } = await client.from("telescope_profiles").delete().eq("id", id).select("id");
      if (error) fail(error);
      if (data.length === 0) throw new NotFoundError("Profile", id);
      notify();
    },

    async listAccessories() {
      const { data, error } = await client.from("accessories").select("*").order("created_at", { ascending: false });
      if (error) fail(error);
      return data.map(accessoryFromRow).filter(defined);
    },
    async createAccessory(input) {
      const data = validate(accessoryInputSchema, input) as AccessoryInput;
      const { data: row, error } = await client.from("accessories").insert(accessoryColumns(data)).select().single();
      if (error) fail(error);
      notify();
      return accessoryFromRow(row)!;
    },
    async updateAccessory(id, input) {
      const data = validate(accessoryInputSchema, input) as AccessoryInput;
      if (!UUID.test(id)) throw new NotFoundError("Accessory", id);
      const { data: row, error } = await client.from("accessories").update(accessoryColumns(data)).eq("id", id).select().maybeSingle();
      if (error) fail(error);
      if (!row) throw new NotFoundError("Accessory", id);
      notify();
      return accessoryFromRow(row)!;
    },
    async deleteAccessory(id) {
      if (!UUID.test(id)) throw new NotFoundError("Accessory", id);
      const { data, error } = await client.from("accessories").delete().eq("id", id).select("id");
      if (error) fail(error);
      if (data.length === 0) throw new NotFoundError("Accessory", id);
      notify();
    },

    async listConfigurations() {
      const { data, error } = await client
        .from("telescope_configurations")
        .select(CONFIGURATION_SELECT)
        .order("created_at", { ascending: false });
      if (error) fail(error);
      return (data as ConfigurationRow[]).map(configurationFromRow).filter(defined);
    },
    getConfiguration: fetchConfiguration,
    createConfiguration: (spec) => saveConfiguration(null, spec),
    async updateConfiguration(id, spec) {
      if (!UUID.test(id)) throw new NotFoundError("Configuration", id);
      return saveConfiguration(id, spec);
    },
    async duplicateConfiguration(id) {
      if (!UUID.test(id)) throw new NotFoundError("Configuration", id);
      const { data: newId, error } = await client.rpc("duplicate_configuration", { p_id: id });
      if (error) fail(error, () => new NotFoundError("Configuration", id));
      notify();
      return mustFetchConfiguration(newId);
    },
    async deleteConfiguration(id) {
      if (!UUID.test(id)) throw new NotFoundError("Configuration", id);
      const { data, error } = await client.from("telescope_configurations").delete().eq("id", id).select("id");
      if (error) fail(error);
      if (data.length === 0) throw new NotFoundError("Configuration", id);
      notify();
    },

    async listSessions() {
      const { data, error } = await client.from("simulation_sessions").select(SESSION_SELECT).order("created_at", { ascending: false });
      if (error) fail(error);
      return (data as unknown as SessionRow[]).map(sessionFromRow).filter(defined);
    },
    getSession: fetchSession,
    async createSession(input: NewSession) {
      validate(newSessionSchema, input);
      const { data: id, error } = await client.rpc("create_session", { p_session: input as unknown as Json });
      if (error) fail(error);
      notify();
      const s = await fetchSession(id);
      if (!s) throw new Error("Session was saved but could not be read back.");
      return s;
    },
    async deleteSession(id) {
      if (!UUID.test(id)) throw new NotFoundError("Session", id);
      const { data, error } = await client.from("simulation_sessions").delete().eq("id", id).select("id");
      if (error) fail(error);
      if (data.length === 0) throw new NotFoundError("Session", id);
      notify();
    },

    async listProjects() {
      const { data, error } = await client.from("observation_projects").select(PROJECT_SELECT).order("created_at", { ascending: false });
      if (error) fail(error);
      return (data as ProjectRow[]).map(projectFromRow).filter(defined);
    },
    getProject: fetchProject,
    async createProject(input) {
      const data = validate(observationProjectInputSchema, input);
      const { data: row, error } = await client.from("observation_projects").insert(projectColumns(data)).select("id").single();
      if (error) fail(error);
      notify();
      return mustFetchProject(row.id);
    },
    async updateProject(id, input) {
      const data = validate(observationProjectInputSchema, input);
      if (!UUID.test(id)) throw new NotFoundError("Project", id);
      const { data: row, error } = await client.from("observation_projects").update(projectColumns(data)).eq("id", id).select("id").maybeSingle();
      if (error) fail(error);
      if (!row) throw new NotFoundError("Project", id);
      notify();
      return mustFetchProject(id);
    },
    async deleteProject(id) {
      if (!UUID.test(id)) throw new NotFoundError("Project", id);
      const { data, error } = await client.from("observation_projects").delete().eq("id", id).select("id");
      if (error) fail(error);
      if (data.length === 0) throw new NotFoundError("Project", id);
      notify();
    },
    async addSessionToProject(projectId, sessionId) {
      await mustFetchProject(projectId);
      // RLS hides other users' sessions, so this also rejects those.
      const { data: found, error: lookupError } = UUID.test(sessionId)
        ? await client.from("simulation_sessions").select("id").eq("id", sessionId).maybeSingle()
        : { data: null, error: null };
      if (lookupError) fail(lookupError);
      if (!found) throw new NotFoundError("Session", sessionId);
      const { error } = await client
        .from("project_sessions")
        .upsert({ project_id: projectId, session_id: sessionId }, { onConflict: "project_id,session_id", ignoreDuplicates: true });
      if (error) fail(error, undefined, () => new NotFoundError("Session", sessionId));
      notify();
    },
    async removeSessionFromProject(projectId, sessionId) {
      await mustFetchProject(projectId);
      if (!UUID.test(sessionId)) return;
      const { error } = await client.from("project_sessions").delete().eq("project_id", projectId).eq("session_id", sessionId);
      if (error) fail(error);
      notify();
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
