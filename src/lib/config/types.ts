import type { Duration, WorkingClock } from "../clock/index.js";

/** The four groups a login belongs to. */
export type Group = "team" | "internal" | "external" | "bot";

/**
 * Logins and the group each belongs to, keyed in lower case because GitHub
 * logins ignore case.
 */
export type People = ReadonlyMap<string, Group>;

/** A watched repository, under the short name thread references use. */
export interface Repo {
  readonly name: string;
  /** `owner/name` on GitHub. */
  readonly repo: string;
  readonly tags: readonly string[];
}

/** How long each kind of wait may run before it is over target. */
export interface Targets {
  readonly nextMove: { readonly response: Duration; readonly review: Duration };
  readonly close: {
    readonly issue: Duration;
    readonly pullRequest: Duration;
    readonly discussion: Duration;
  };
}

/** Labels that switch a metric off for a thread. */
export interface Exempt {
  readonly close: readonly string[];
}

/** Every setting docket reads, with each value decided. */
export interface Settings {
  readonly repos: readonly Repo[];
  readonly people: People;
  readonly time: WorkingClock;
  readonly targets: Targets;
  readonly exempt: Exempt;
  /** Activity's time windows, the first being the default. */
  readonly activity: readonly Duration[];
  readonly hosts: readonly string[];
}

export type Section = keyof Settings;

/**
 * The sections one file declares. A declared section may leave keys out,
 * and those come from the built-in defaults.
 */
export interface Layer {
  readonly repos?: readonly Repo[];
  readonly people?: People;
  readonly time?: Partial<WorkingClock>;
  readonly targets?: {
    readonly nextMove?: Partial<Targets["nextMove"]>;
    readonly close?: Partial<Targets["close"]>;
  };
  readonly exempt?: Partial<Exempt>;
  readonly activity?: readonly Duration[];
  readonly hosts?: readonly string[];
}

/** Which file a layer comes from. */
export type Place = "personal" | "repository";

/**
 * The named codes of configuration errors. Callers and scripts depend on
 * them, so a code is never renamed or reused.
 */
export type ConfigErrorCode =
  | "CONFIG_DUPLICATE_KEY"
  | "CONFIG_DURATION"
  | "CONFIG_EMPTY"
  | "CONFIG_GROUP"
  | "CONFIG_HOST"
  | "CONFIG_REPO"
  | "CONFIG_SECTION_NOT_ALLOWED"
  | "CONFIG_SYNTAX"
  | "CONFIG_TIMEZONE"
  | "CONFIG_TYPE"
  | "CONFIG_UNKNOWN_KEY"
  | "CONFIG_VERSION"
  | "CONFIG_WORKDAY";

/** One problem in a configuration file, and how to fix it. */
export interface ConfigError {
  readonly code: ConfigErrorCode;
  /** One sentence naming the problem and where it is. */
  readonly message: string;
  /** What to change so the file is accepted. */
  readonly recovery: string;
}

/** A file's sections when it is valid, or every error it holds. */
export type FileOutcome =
  | { readonly ok: true; readonly layer: Layer }
  | { readonly ok: false; readonly errors: readonly ConfigError[] };
