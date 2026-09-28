import type { ActivityAddress } from "../lib/activity/index.js";
import type { Cache, CachedEvents } from "../lib/cache/index.js";
import type {
  PersonalFile,
  Repo,
  Resolved,
  Settings,
} from "../lib/config/index.js";
import type { OwedGrouping } from "../lib/owed/index.js";
import type {
  Capability,
  Provider,
  ThreadDetail,
} from "../lib/provider/index.js";
import type {
  CommandName,
  Detail,
  Format,
  Freshness,
  Problem,
} from "../lib/text/index.js";
import type { Thread, ThreadSummary } from "../lib/waits/index.js";
import type { WriteAction, WriteOutcome, WriteRequest } from "./writeSet.js";

/** What the process gives docket: its arguments, its world and its output. */
export interface Context {
  /** The arguments after the program's name. */
  readonly args: readonly string[];
  readonly environment: Readonly<Record<string, string | undefined>>;
  /** Whether a terminal shows the output, rather than a pipe or a file. */
  readonly interactive: boolean;
  /**
   * Whether a terminal gives the input, rather than a pipe or a file, so
   * that keys can be read from it.
   */
  readonly interactiveInput: boolean;
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
  /** Whether `--format` named the format, rather than the output choosing it. */
  readonly formatGiven: boolean;
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

/** The two modes of the terminal interface. */
export type TerminalMode = "owed" | "activity";

/** What the terminal interface shows, and where its data comes from. */
export interface TerminalView {
  /** The mode it opens on. */
  readonly mode: TerminalMode;
  /**
   * The grouping owed opens on, which `docket owed --by` names: the
   * header and the call name one address.
   */
  readonly owedGrouping: OwedGrouping;
  /**
   * The window and grouping activity opens on: those `--window` and
   * `--by` name when `docket activity` opens the interface, and the first
   * of each when absent. The window is one of `settings.activity`, the
   * list `t` steps through.
   */
  readonly activity?: Pick<ActivityAddress, "window" | "grouping">;
  /** The current time, read whenever an age is measured. */
  readonly now: () => Date;
  /** Opens a thread's page in the browser, and rejects when it cannot. */
  readonly openInBrowser: (url: string) => Promise<void>;
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
         * Reads a thread's details from the provider, for the accordion
         * under the selected row.
         */
        readonly readDetail: (thread: ThreadSummary) => Promise<ThreadDetail>;
        /**
         * Reads from GitHub, never the cache, whom an editor offers for
         * `thread` and the set it holds.
         */
        readonly readCandidates: (
          action: WriteAction,
          thread: Thread,
        ) => Promise<Candidates>;
        /**
         * Writes the thread's whole set as `docket assign --confirm` and
         * `docket review --confirm` do, refreshing the thread after it.
         */
        readonly write: (
          request: Pick<
            WriteRequest,
            "action" | "thread" | "reference" | "wanted"
          >,
        ) => Promise<WriteOutcome>;
        /**
         * Reads each watched repository's own file, called once the
         * interface has opened, so a slow or unreachable GitHub never
         * holds up the first frame. It never rejects: a failure comes back
         * as the problem the interface shows in place of the list.
         */
        readonly readWatched: () => Promise<WatchedFiles>;
        /**
         * Reads the events of a repository at or after `since` through
         * the cache, no older than the call's maximum age.
         */
        readonly readEvents: (
          repo: string,
          since: Date,
        ) => Promise<CachedEvents>;
      }
    | { readonly problem: Problem };
}

/**
 * Each watched repository with the settings its own file gives it, or the
 * failure that stopped the files being read, such as GitHub refusing gh's
 * token.
 */
export type WatchedFiles =
  | { readonly watched: readonly Watched[] }
  | { readonly problem: Problem };

/** Whom an editor offers, as GitHub gives it when the editor opens. */
export interface Candidates {
  /** The set GitHub holds, which the editor opens ticked. */
  readonly current: readonly string[];
  /**
   * Everyone else GitHub offers, in its order: everyone it can assign, or
   * its suggested reviewers, the collaborators and the teams.
   */
  readonly offered: readonly string[];
}

/**
 * The thread `a` or `r` acts on: the selected row's reference, and the
 * thread as the cache holds it. The cache holds open threads alone, so
 * the thread is absent for one activity shows that was not open at the
 * last refresh, such as one closed since.
 */
export interface SelectedThread {
  /** `example#12`. */
  readonly reference: string;
  readonly thread?: Thread;
}
