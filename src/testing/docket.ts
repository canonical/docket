/**
 * Runs docket's text interface in-process, on a temporary configuration
 * and cache folder, with a provider given at the port and a fixed clock.
 */
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import parseArguments from "../application/parseArguments.js";
import run from "../application/run.js";
import type { Context, Session } from "../application/types.js";
import { createCache, locateCacheDirectory } from "../lib/cache/index.js";
import { parseFile, resolveSettings } from "../lib/config/index.js";
import type { Provider } from "../lib/provider/index.js";
import { recordedNow, recordedProvider } from "./recorded.js";

/** The personal file of the recording: both repositories, alice and bob on the team. */
export const recordedPersonalFile = `version: 1
repos:
  example: { repo: example-org/example-repo }
  docs: { repo: example-org/example-docs }
people:
  alice: team
  bob: team
time:
  timezone: Europe/Paris
activity: [72h, 1w]
`;

/** What one call printed, and how it exited. */
export interface Outcome {
  readonly code: number;
  readonly out: string;
  readonly err: string;
}

/** A folder holding docket's configuration and cache for one test. */
export interface Home {
  readonly root: string;
  /** Runs docket with `args`, as a piped call unless `interactive`. */
  call(
    args: readonly string[],
    options?: {
      readonly provider?: Provider | (() => Promise<Provider>);
      readonly interactive?: boolean;
      readonly now?: Date;
    },
  ): Promise<Outcome>;
  remove(): Promise<void>;
}

/**
 * Makes a home with `personal` as the personal file, or none when it is
 * `null`.
 */
export async function makeHome(
  personal: string | null = recordedPersonalFile,
): Promise<Home> {
  const root = await mkdtemp(join(tmpdir(), "docket-text-"));
  if (personal !== null) {
    await mkdir(join(root, "config", "docket"), { recursive: true });
    await writeFile(join(root, "config", "docket", "docket.yaml"), personal);
  }
  return {
    root,
    async call(args, options = {}) {
      let out = "";
      let err = "";
      const given = options.provider ?? recordedProvider();
      const code = await run({
        args,
        environment: {
          XDG_CONFIG_HOME: join(root, "config"),
          XDG_CACHE_HOME: join(root, "cache"),
        },
        interactive: options.interactive ?? false,
        write: (text) => {
          out += text;
        },
        writeError: (text) => {
          err += text;
        },
        now: () => options.now ?? recordedNow,
        connect: async () => (typeof given === "function" ? given() : given),
        version: "1.2.3",
      });
      return { code, out, err };
    },
    remove: () => rm(root, { recursive: true, force: true }),
  };
}

/** A session for one command, and what it printed. */
export interface OpenSession {
  readonly session: Session;
  readonly out: () => string;
  readonly err: () => string;
}

/**
 * Opens a session on `home` as `run` would for `args`, on the recording's
 * personal file, with `provider` at the port and a fixed clock.
 */
export function openSession(
  home: Home,
  args: readonly string[],
  provider: Provider = recordedProvider(),
  now: Date = recordedNow,
): OpenSession {
  const request = parseArguments(args, false);
  if (request.kind !== "command")
    throw new Error("the arguments name a command");
  const outcome = parseFile(recordedPersonalFile, "personal");
  if (!outcome.ok) throw new Error("the personal file is valid");
  const resolved = resolveSettings(outcome.layer, undefined);
  let out = "";
  let err = "";
  const environment = { XDG_CACHE_HOME: join(home.root, "cache") };
  const context: Context = {
    args,
    environment,
    interactive: false,
    write: (text) => {
      out += text;
    },
    writeError: (text) => {
      err += text;
    },
    now: () => now,
    connect: async () => provider,
    version: "1.2.3",
  };
  const session: Session = {
    context,
    invocation: request.invocation,
    personal: { path: join(home.root, "docket.yaml"), outcome },
    resolved,
    watched: resolved.settings.repos.map((repo) => ({ ...repo, resolved })),
    provider,
    cache: createCache({
      provider,
      repos: resolved.settings.repos.map(({ repo }) => repo),
      directory: locateCacheDirectory(environment),
      now: () => now,
    }),
    describeFreshness: (syncedAt, warnings = []) => ({
      now,
      syncedAt,
      timezone: resolved.settings.time.timezone,
      warnings,
    }),
  };
  return { session, out: () => out, err: () => err };
}
