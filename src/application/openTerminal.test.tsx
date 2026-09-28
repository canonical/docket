import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { CliRendererConfig } from "@opentui/core";
import {
  createTestRenderer,
  type TestRendererSetup,
} from "@opentui/core/testing";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createCache } from "../lib/cache/index.js";
import { everyCapability, fakeProvider } from "../testing/provider.js";
import {
  parserFixDetail,
  recordedNow,
  recordedRepos,
  recordedSettings,
  recordedWatched,
} from "../testing/recorded.js";
import openTerminal from "./openTerminal.js";
import type { TerminalView } from "./types.js";

const folders: string[] = [];
afterEach(async () => {
  for (const folder of folders.splice(0)) {
    await rm(folder, { recursive: true, force: true });
  }
});

/** Opens the interface on a test renderer, and gives the renderer too. */
async function open(view: TerminalView) {
  const { promise, resolve } = Promise.withResolvers<TestRendererSetup>();
  const closed = openTerminal(view, async (config: CliRendererConfig) => {
    const setup = await createTestRenderer({
      ...config,
      width: 40,
      height: 12,
    });
    resolve(setup);
    return setup.renderer;
  });
  const setup = await promise;
  return { setup, closed };
}

async function openCache(snapshot = vi.fn(fakeProvider().snapshot)) {
  const directory = await mkdtemp(join(tmpdir(), "docket-terminal-"));
  folders.push(directory);
  const cache = createCache({
    provider: fakeProvider({ snapshot }),
    repos: recordedRepos.map(({ repo }) => repo),
    directory,
    now: () => recordedNow,
  });
  return { cache, snapshot };
}

describe("openTerminal", () => {
  it("draws owed, refreshes while open, and exits 0 once q closes it", async () => {
    const { cache, snapshot } = await openCache();
    const { setup, closed } = await open({
      mode: "owed",
      owedGrouping: "none",
      now: () => recordedNow,
      settings: recordedSettings,
      watched: recordedWatched(),
      source: {
        cache,
        capabilities: everyCapability,
        readWatched: async () => ({ watched: recordedWatched() }),
        readDetail: async () => parserFixDetail,
      },
    });
    await vi.waitFor(() => expect(snapshot).toHaveBeenCalledTimes(2));
    await vi.waitFor(async () => {
      await setup.renderOnce();
      const frame = setup.captureCharFrame();
      expect(frame).toContain("nothing owed");
      expect(frame).toContain("←→ mode ↑↓ sel g grp ?");
    });
    setup.mockInput.pressKey("q");
    expect(await closed).toBe(0);
    expect(setup.renderer.isDestroyed).toBe(true);
  });

  it("closes at once while a request GitHub never answers is waiting", async () => {
    const snapshot = vi.fn(() => new Promise<never>(() => {}));
    const { cache } = await openCache(snapshot);
    const { setup, closed } = await open({
      mode: "owed",
      owedGrouping: "none",
      now: () => recordedNow,
      settings: recordedSettings,
      watched: recordedWatched(),
      source: {
        cache,
        capabilities: everyCapability,
        readWatched: () => new Promise(() => {}),
        readDetail: async () => parserFixDetail,
      },
    });
    await vi.waitFor(() => expect(snapshot).toHaveBeenCalled());
    setup.mockInput.pressKey("q");
    const started = Date.now();
    expect(await closed).toBe(0);
    expect(Date.now() - started).toBeLessThan(1_000);
  });

  it("never refreshes when gh gave no token", async () => {
    const { setup, closed } = await open({
      mode: "owed",
      owedGrouping: "none",
      now: () => recordedNow,
      settings: recordedSettings,
      watched: [],
      source: {
        problem: {
          code: "GH_NOT_SIGNED_IN",
          message: "gh is not signed in to github.com.",
          recovery: "run gh auth login",
        },
      },
    });
    await vi.waitFor(async () => {
      await setup.renderOnce();
      const frame = setup.captureCharFrame();
      expect(frame).toContain("✗ gh is not signed in to github.com");
      // The keys work once the key bar, drawn from them, shows.
      expect(frame).toContain("←→ mode ↑↓ sel g grp ?");
    });
    setup.mockInput.pressKey("q");
    expect(await closed).toBe(0);
  });
});
