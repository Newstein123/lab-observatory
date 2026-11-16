import type { ConfigurationSpec, TelescopeConfiguration } from "@/modules/configurations/models";
import type { Accessory, AccessoryInput, TelescopeProfile, TelescopeProfileInput } from "@/modules/equipment/models";
import type { ObservationProject, ObservationProjectInput } from "@/modules/projects/models";
import type { NewSession, SimulationSession } from "@/modules/sessions/models";

/**
 * Storage boundary for the user's private records. The UI depends only on
 * this interface; implementations (browser storage now, Supabase later) are
 * swappable. All methods are async so a network-backed adapter fits.
 *
 * Implementations must validate inputs and enforce ownership.
 */
export interface ObservatoryRepository {
  // Equipment profiles
  listProfiles(): Promise<TelescopeProfile[]>;
  getProfile(id: string): Promise<TelescopeProfile | undefined>;
  createProfile(input: TelescopeProfileInput): Promise<TelescopeProfile>;
  /** Also updates the optics of configurations linked to this profile. */
  updateProfile(id: string, input: TelescopeProfileInput): Promise<TelescopeProfile>;
  /** Linked configurations keep their optics and become unlinked. */
  deleteProfile(id: string): Promise<void>;

  // Accessories (eyepieces, cameras, Barlows, filters, mounts)
  listAccessories(): Promise<Accessory[]>;
  createAccessory(input: AccessoryInput): Promise<Accessory>;
  updateAccessory(id: string, input: AccessoryInput): Promise<Accessory>;
  deleteAccessory(id: string): Promise<void>;

  // Configurations
  listConfigurations(): Promise<TelescopeConfiguration[]>;
  getConfiguration(id: string): Promise<TelescopeConfiguration | undefined>;
  createConfiguration(spec: ConfigurationSpec): Promise<TelescopeConfiguration>;
  /** Increments `version`. */
  updateConfiguration(id: string, spec: ConfigurationSpec): Promise<TelescopeConfiguration>;
  duplicateConfiguration(id: string): Promise<TelescopeConfiguration>;
  deleteConfiguration(id: string): Promise<void>;

  // Sessions (immutable once saved)
  listSessions(): Promise<SimulationSession[]>;
  getSession(id: string): Promise<SimulationSession | undefined>;
  createSession(session: NewSession): Promise<SimulationSession>;
  /** Also removes the session from any project. */
  deleteSession(id: string): Promise<void>;

  // Observation projects
  listProjects(): Promise<ObservationProject[]>;
  getProject(id: string): Promise<ObservationProject | undefined>;
  createProject(input: ObservationProjectInput): Promise<ObservationProject>;
  updateProject(id: string, input: ObservationProjectInput): Promise<ObservationProject>;
  /** Sessions in the project are kept. */
  deleteProject(id: string): Promise<void>;
  /** Idempotent. The session must exist and belong to the same user. */
  addSessionToProject(projectId: string, sessionId: string): Promise<void>;
  removeSessionFromProject(projectId: string, sessionId: string): Promise<void>;

  /** Notified after any change, including changes from other browser tabs. */
  subscribe(listener: () => void): () => void;
}

export class NotFoundError extends Error {
  constructor(kind: string, id: string) {
    super(`${kind} not found: ${id}`);
    this.name = "NotFoundError";
  }
}

export class ValidationError extends Error {
  constructor(public readonly issues: { path: string; message: string }[]) {
    super(`Invalid data: ${issues.map((i) => `${i.path || "(root)"}: ${i.message}`).join("; ")}`);
    this.name = "ValidationError";
  }
}
