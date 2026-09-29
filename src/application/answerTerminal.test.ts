import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createCache } from "../lib/cache/index.js";
import type { Provider } from "../lib/provider/index.js";
import type { Problem } from "../lib/text/index.js";
import { fakeProvider, providerError } from "../testing/provider.js";
import {
  parserFix,
  parserFixDetail,
  recordedNow,
  recordedProvider,
  recordedSettings,
  recordedThreads,
  resolvedPersonal,
} from "../testing/recorded.js";
import { waitUntil } from "../testing/wait.js";
import answerTerminal from "./answerTerminal.js";
import type { Context, TerminalView } from "./types.js";

let root: string;
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "docket-terminal-"));
});
afterEach(() => rm(root, { recursive: true, force: true }));

/**
 * Opens the interface on `given`, with the cache on it when it is a
 * provider, giving the view it was opened on.
 */
async function openOn(
  given: Provider | Problem,
  activity?: TerminalView["activity"],
) {
  const connection =
    "code" in given
      ? given
      : {
          provider: given,
          cache: createCache({
            provider: given,
            repos: recordedSettings.repos.map(({ repo }) => repo),
            directory: root,
            now: () => recordedNow,
          }),
        };
  const views: TerminalView[] = [];
  const context: Context = {
    args: [],
    environment: {},
    interactive: true,
    interactiveInput: true,
    write: () => {},
    writeError: () => {},
    now: () => recordedNow,
    connect: () => Promise.reject(new Error("connected already")),
    openTerminal: async (view) => {
      views.push(view);
      return 0;
    },
    version: "1.2.3",
  };
  const code = await answerTerminal(
    context,
    "owed",
    "owner",
    300_000,
    undefined,
    recordedSettings,
    connection,
    activity,
  );
  return { code, view: views.at(0) };
}

/** The cache source a view opened on, or a failure when it has none. */
function cacheOf(view: TerminalView | undefined) {
  const source = view?.source;
  if (!source || !("cache" in source)) throw new Error("opened on a cache");
  return source;
}

describe("answerTerminal", () => {
  it("opens on the shared cache, with the personal file's settings and the provider's facts", async () => {
    const { code, view } = await openOn(recordedProvider());
    expect(code).toBe(0);
    expect(view?.watched.map(({ name }) => name)).toEqual(["example", "docs"]);
    expect(view?.watched.map(({ resolved }) => resolved)).toEqual([
      resolvedPersonal(false),
      resolvedPersonal(false),
    ]);
    expect(view?.mode).toBe("owed");
    expect(view?.owedGrouping).toBe("owner");
    expect(view?.settings).toBe(recordedSettings);
    expect(view?.now()).toEqual(recordedNow);
    const source = cacheOf(view);
    expect(source.capabilities.has("stacks")).toBe(true);
    expect(source.cache.threads().syncedAt).toBeUndefined();
  });

  it("opens before any repository file is read, even when GitHub never answers", async () => {
    const readFile = vi.fn(() => new Promise<undefined>(() => {}));
    const { view } = await openOn(fakeProvider({ readFile }));
    expect(view).toBeDefined();
    expect(readFile).not.toHaveBeenCalled();
    void cacheOf(view).readWatched();
    await waitUntil(() => expect(readFile).toHaveBeenCalledOnce());
  });

  it("reads each repository's settings once the interface asks", async () => {
    const { view } = await openOn(recordedProvider());
    const files = await cacheOf(view).readWatched();
    if (!("watched" in files)) throw new Error("the files were read");
    expect(files.watched.map(({ name }) => name)).toEqual(["example", "docs"]);
  });

  it("reads a thread's details from the provider, for the accordion", async () => {
    const { view } = await openOn(recordedProvider());
    const [thread] = recordedThreads;
    if (!thread) throw new Error("the recording has a thread");
    expect(await cacheOf(view).readDetail(thread)).toEqual(parserFixDetail);
  });

  it("gives the editors whom GitHub offers, and writes as a confirmed text write does", async () => {
    const setAssignees = vi.fn(recordedProvider().setAssignees);
    const { view } = await openOn(recordedProvider({ setAssignees }));
    const source = cacheOf(view);
    await source.cache.read(0);
    expect(await source.readCandidates("review", parserFix)).toMatchObject({
      current: ["bob"],
    });
    const outcome = await source.write({
      action: "assign",
      thread: parserFix,
      reference: "example#12",
      wanted: ["mallory"],
    });
    expect(setAssignees).toHaveBeenCalledWith(parserFix, ["mallory"]);
    expect(outcome.applied).toEqual(["mallory"]);
    expect(outcome.shortfall).toBeUndefined();
  });

  it("reads activity's events through the cache, fetching them only when older than the maximum age", async () => {
    const events = vi.fn(recordedProvider().events);
    const { view } = await openOn(recordedProvider({ events }));
    const since = new Date("2026-09-20T10:00:00Z");
    const read = await cacheOf(view).readEvents(
      "example-org/example-docs",
      since,
    );
    expect(read.events.map(({ kind }) => kind)).toEqual(["labelled"]);
    await cacheOf(view).readEvents("example-org/example-docs", since);
    expect(events).toHaveBeenCalledOnce();
  });

  it("hands the interface the window and grouping activity opens on, with or without a token", async () => {
    const activity = {
      window: { amount: 72, unit: "h" },
      grouping: "repo",
    } as const;
    const { view } = await openOn(recordedProvider(), activity);
    expect(view?.activity).toEqual(activity);
    const problem = {
      code: "GH_NOT_INSTALLED",
      message: "docket needs the GitHub CLI (gh).",
      recovery: "install it",
    } as const;
    const refused = await openOn(problem, activity);
    expect(refused.view?.activity).toEqual(activity);
  });

  it("opens on why gh gave no token", async () => {
    const problem = {
      code: "GH_NOT_INSTALLED",
      message: "docket needs the GitHub CLI (gh).",
      recovery: "install it",
    } as const;
    const { view } = await openOn(problem);
    expect(view).toMatchObject({ watched: [], source: { problem } });
  });

  it("gives GitHub refusing gh's token while the repository files are read", async () => {
    const provider: Provider = fakeProvider({
      readFile: () => Promise.reject(providerError("GH_NOT_SIGNED_IN")),
    });
    const { view } = await openOn(provider);
    expect(await cacheOf(view).readWatched()).toEqual({
      problem: {
        code: "GH_NOT_SIGNED_IN",
        message: "The provider failed with GH_NOT_SIGNED_IN.",
        recovery: "try again",
      },
    });
  });

  it("gives a failure without a named code as UNEXPECTED_FAILURE, never rejecting", async () => {
    const provider = fakeProvider({
      readFile: () => Promise.reject(new Error("disk on fire")),
    });
    const { view } = await openOn(provider);
    expect(await cacheOf(view).readWatched()).toEqual({
      problem: {
        code: "UNEXPECTED_FAILURE",
        message:
          "docket stopped on a failure it has no name for: disk on fire.",
        recovery: "run the command again; if it keeps failing, report it",
      },
    });
  });
});
