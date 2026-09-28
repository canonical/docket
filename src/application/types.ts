import type { Cache } from "../lib/cache/index.js";
import type {
  PersonalFile,
  Repo,
  Resolved,
  Settings,
} from "../lib/config/index.js";
import type { Capability, Provider } from "../lib/provider/index.js";
import type {
  CommandName,
  Detail,
  Format,
  Freshness,
  Problem,
} from "../lib/text/index.js";

/** What the process gives docket: its arguments, its world and its output. */
export interface Context {
  /** The arguments after the program's name. */
  readonly args: readonly string[];
  readonly environment: Readonly<Record<string, string | undefined>>;
  /** Whether a terminal shows the output, rather than a pipe or a file. */
  readonly interactive: boolean;
  /** Writes the answer. */
  readonly write: (text: string) => void;
  /** Writes an error. */
  readonly writeError: (text: string) => void;
  /** The current time, read whenever an age is measured. */
  readonly now: () => Date;
  /**
   * Connects to the host's GitHub as gh is signed in.
   *
   * @throws ProviderError `GH_*` when gh gives no token.
   */
  readonly connect: (host: string) => Promise<Provider>;
  /**
   * Opens the terminal interface on `view`, and gives the exit code once
   * it is quit.
   */
  readonly openTerminal: (view: TerminalView) => Promise<number>;
  readonly version: string;
}

/** A call, parsed and checked against the command catalogue. */
export interface Invocation {
  readonly command: CommandName;
  /** The arguments after the command's name. */
  readonly positionals: readonly string[];
  readonly format: Format;
  readonly detail: Detail;
  /** How old cached data may be, in milliseconds. */
  readonly maxAge: number;
  readonly by: string | undefined;
  readonly window: string | undefined;
  readonly confirm: boolean;
}

/** A watched repository, with the settings in effect for it. */
export interface Watched extends Repo {
  /**
   * The settings from the built-in defaults, the personal file and the
   * repository's own file, and that file's errors when it is invalid.
   */
  readonly resolved: Resolved;
}

/** The provider gh's token opened, and the shared cache on it. */
export interface Connection {
  readonly provider: Provider;
  readonly cache: Cache;
}

/** Everything a command needs once the call, the settings and gh are ready. */
export interface Session {
  readonly context: Context;
  readonly invocation: Invocation;
  readonly personal: PersonalFile;
  /**
   * The settings that hold across repositories, from the built-in
   * defaults and the personal file: the repositories watched, the
   * activity windows, the host and the time zone times are written in.
   */
  readonly resolved: Resolved;
  /** Each watched repository, in the configuration's order, with its settings. */
  readonly watched: readonly Watched[];
  readonly provider: Provider;
  readonly cache: Cache;
  /**
   * How old data synced at `syncedAt` is, with the warnings in force:
   * `warnings`, after any repository file GitHub failed to give.
   */
  readonly describeFreshness: (
    syncedAt: Date | undefined,
    warnings?: Freshness["warnings"],
  ) => Freshness;
}

/** What the terminal interface shows, and where its data comes from. */
export interface TerminalView {
  /** The current time, read whenever an age is measured. */
  readonly now: () => Date;
  /**
   * The settings that hold across repositories: the activity windows
   * and the time zone times are written in.
   */
  readonly settings: Settings;
  /**
   * Each watched repository, in the configuration's order, with the
   * settings it opens on: the built-in defaults and the personal file,
   * until its own file is read.
   */
  readonly watched: readonly Watched[];
  /**
   * The shared cache, the facts the provider supplies and a reading of
   * the repositories' own files, or why gh gave no token.
   */
  readonly source:
    | {
        readonly cache: Cache;
        readonly capabilities: ReadonlySet<Capability>;
        /**
         * Reads each watched repository's own file, called once the
         * interface has opened, so a slow or unreachable GitHub never
         * holds up the first frame.
         */
        readonly readWatched: () => Promise<WatchedFiles>;
      }
    | { readonly problem: Problem };
}

/**
 * Each watched repository with the settings its own file gives it, or why
 * GitHub refused gh's token while the files were read.
 */
export type WatchedFiles =
  | { readonly watched: readonly Watched[] }
  | { readonly problem: Problem };
