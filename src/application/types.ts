import type { Cache } from "../lib/cache/index.js";
import type { PersonalFile, Resolved } from "../lib/config/index.js";
import type { Provider } from "../lib/provider/index.js";
import type {
  CommandName,
  Detail,
  Format,
  Freshness,
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
}

/** Everything a command needs once the call, the settings and gh are ready. */
export interface Session {
  readonly context: Context;
  readonly invocation: Invocation;
  readonly personal: PersonalFile;
  /** The settings in effect, from the built-in defaults and the personal file. */
  readonly resolved: Resolved;
  readonly provider: Provider;
  readonly cache: Cache;
  /** How old data synced at `syncedAt` is, with the warnings in force. */
  readonly describeFreshness: (
    syncedAt: Date | undefined,
    warnings?: Freshness["warnings"],
  ) => Freshness;
}
