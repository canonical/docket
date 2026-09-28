import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createCache } from "../lib/cache/index.js";
import type { Provider } from "../lib/provider/index.js";
import type { Problem } from "../lib/text/index.js";
import { fakeProvider, providerError } from "../testing/provider.js";
import {
  recordedNow,
  recordedProvider,
  recordedSettings,
} from "../testing/recorded.js";
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
async function openOn(given: Provider | Problem) {
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
    environment: { XDG_CACHE_HOME: root },
    interactive: true,
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
    300_000,
    undefined,
    recordedSettings,
    connection,
  );
  return { code, view: views.at(0) };
}

describe("answerTerminal", () => {
  it("opens on the shared cache, with each repository's settings and the provider's facts", async () => {
    const { code, view } = await openOn(recordedProvider());
    expect(code).toBe(0);
    expect(view?.watched.map(({ name }) => name)).toEqual(["example", "docs"]);
    expect(view?.settings).toBe(recordedSettings);
    expect(view?.now()).toEqual(recordedNow);
    const source = view?.source;
    if (!source || !("cache" in source)) throw new Error("opened on a cache");
    expect(source.capabilities.has("stacks")).toBe(true);
    expect(source.cache.threads().syncedAt).toBeUndefined();
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

  it("opens on GitHub refusing gh's token while the repository files are read", async () => {
    const provider: Provider = fakeProvider({
      readFile: () => Promise.reject(providerError("GH_NOT_SIGNED_IN")),
    });
    const { view } = await openOn(provider);
    expect(view?.source).toEqual({
      problem: {
        code: "GH_NOT_SIGNED_IN",
        message: "The provider failed with GH_NOT_SIGNED_IN.",
        recovery: "try again",
      },
    });
  });

  it("lets a failure without a named code through", async () => {
    const provider = fakeProvider({
      readFile: () => Promise.reject(new Error("disk on fire")),
    });
    await expect(openOn(provider)).rejects.toThrow("disk on fire");
  });
});
