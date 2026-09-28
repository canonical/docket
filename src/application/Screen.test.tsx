import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { type Cache, createCache } from "../lib/cache/index.js";
import type { Capability, Provider } from "../lib/provider/index.js";
import { tokens } from "../lib/tokens/index.js";
import {
  everyCapability,
  fakeProvider,
  fullBudget,
  providerError,
} from "../testing/provider.js";
import {
  recordedNow,
  recordedProvider,
  recordedRepos,
  recordedSettings,
  recordedWatched,
} from "../testing/recorded.js";
import { type Screen as Drawn, draw, WithKeys } from "../testing/terminal.js";
import Screen from "./Screen.js";
import type { TerminalView, WatchedFiles } from "./types.js";

const folders: string[] = [];
afterEach(async () => {
  for (const folder of folders.splice(0)) {
    await rm(folder, { recursive: true, force: true });
  }
});

/** A cache of the recording's repositories in a folder of its own. */
async function openCache(provider: Provider, repos = recordedRepos) {
  const directory = await mkdtemp(join(tmpdir(), "docket-screen-"));
  folders.push(directory);
  return createCache({
    provider,
    repos: repos.map(({ repo }) => repo),
    directory,
    now: () => recordedNow,
  });
}

/** Reads the repositories' files as the recording's settings. */
const readRecorded = async (): Promise<WatchedFiles> => ({
  watched: recordedWatched(),
});

function viewOf(
  cache: Cache,
  capabilities: ReadonlySet<Capability> = everyCapability,
  readWatched = readRecorded,
): TerminalView {
  return {
    mode: "owed",
    now: () => recordedNow,
    settings: recordedSettings,
    watched: recordedWatched(),
    source: { cache, capabilities, readWatched },
  };
}

function show(view: TerminalView, width = 40, onQuit = () => {}) {
  return draw(
    <WithKeys>
      <Screen {...view} onQuit={onQuit} />
    </WithKeys>,
    width,
    12,
  );
}

/** Presses `keys` one after another and reads the screen back. */
async function press(screen: Drawn, ...keys: string[]) {
  let drawn = screen;
  for (const key of keys) {
    drawn = await drawn.redraw(() => {
      if (key === "left" || key === "right") {
        screen.setup.mockInput.pressArrow(key);
      } else {
        screen.setup.mockInput.pressKey(key);
      }
    });
  }
  return drawn;
}

describe("Screen", () => {
  describe("before the first data", () => {
    it("opens on owed with the first run's progress and no counts, at 40 columns", async () => {
      const screen = await (
        await show(viewOf(await openCache(fakeProvider())))
      ).redraw();
      expect(screen.lines).toEqual([
        "owed",
        "",
        "  refresh in progress…",
        `  ${"░".repeat(29)} 0/0`,
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "←→ mode g grp ?",
      ]);
      expect(screen.look("refresh in progress")).toMatchObject({
        fg: tokens["color.text"],
        bg: tokens["color.background"],
      });
    });

    it("shows each page as it arrives, and the status names the repository", async () => {
      const { promise, resolve } = Promise.withResolvers<void>();
      const provider = fakeProvider({
        snapshot: async (_repo, _cursor, onPage) => {
          onPage?.({ fetched: 5, total: 9 });
          await promise;
          return { threads: [], cursor: null };
        },
      });
      const cache = await openCache(provider);
      const screen = await show(viewOf(cache), 60);
      const refreshing = cache.refresh();
      await vi.waitFor(() => expect(cache.status().fullRefresh).toBeDefined());
      const drawn = await screen.redraw();
      expect(drawn.lines.slice(2, 4)).toEqual([
        "  refresh in progress…",
        `  ${"█".repeat(16)}${"░".repeat(13)} 5/9`,
      ]);
      expect(drawn.lines.at(10)).toBe("full refresh · example 1/2 · pages 5/9");
      resolve();
      await refreshing;
    });

    it("gives the reason and the recovery when the first fetch fails", async () => {
      const provider = fakeProvider({
        snapshot: () => Promise.reject(providerError("GITHUB_TIMED_OUT")),
      });
      const cache = await openCache(provider);
      const screen = await show(viewOf(cache));
      await cache.refresh();
      const drawn = await screen.redraw();
      expect(drawn.lines.slice(2, 4)).toEqual([
        "  ✗ The provider failed with",
        "  GITHUB_TIMED_OUT",
      ]);
      expect(drawn.lines.at(10)).toBe("✗ offline");
      expect(drawn.look("✗ offline")?.fg).toBe(tokens["color.text.error"]);
    });

    it("says when docket resumes when GitHub rate-limits the first fetch", async () => {
      const provider = fakeProvider({
        snapshot: () => Promise.reject(providerError("GITHUB_RATE_LIMITED")),
      });
      const cache = await openCache(provider);
      const screen = await show(viewOf(cache));
      await cache.refresh();
      const drawn = await screen.redraw();
      expect(drawn.lines.slice(2, 6)).toEqual([
        "  ✗ GitHub refused requests for its rate",
        "  limit",
        "  Recovery: wait: docket resumes at",
        "  13:00",
      ]);
      expect(drawn.lines.at(10)).toBe("✗ rate limited · resumes 13:00");
    });

    it("says when docket resumes when the first fetch waits for the request budget", async () => {
      const provider = fakeProvider({
        budget: async () => ({ ...fullBudget, remaining: 1 }),
      });
      const cache = await openCache(provider);
      const screen = await show(viewOf(cache));
      await cache.refresh();
      const drawn = await screen.redraw();
      expect(drawn.lines.slice(2, 6)).toEqual([
        "  ✗ docket paused the refresh to spare",
        "  the request budget",
        "  Recovery: wait: docket resumes at",
        "  13:00",
      ]);
      expect(drawn.lines.at(10)).toBe("refresh paused · resumes 13:00");
    });

    it("stands in a notice for the list when gh gives no token, with no status", async () => {
      const view: TerminalView = {
        mode: "owed",
        now: () => recordedNow,
        settings: recordedSettings,
        watched: [],
        source: {
          problem: {
            code: "GH_NOT_INSTALLED",
            message: "docket needs the GitHub CLI (gh).",
            recovery:
              "install it from https://cli.github.com, then run gh auth login",
          },
        },
      };
      const screen = await (await show(view)).redraw();
      expect(screen.lines).toEqual([
        "owed",
        "",
        "  ✗ docket needs the GitHub CLI (gh)",
        "  Recovery: install it from",
        "  https://cli.github.com, then run",
        "  gh auth login",
        "",
        "",
        "",
        "",
        "",
        "←→ mode g grp ?",
      ]);
    });
  });

  describe("the repositories' own files", () => {
    it("draws the first frame while the files are still being read", async () => {
      const readWatched = vi.fn(() => new Promise<WatchedFiles>(() => {}));
      const cache = await openCache(fakeProvider());
      const screen = await show(viewOf(cache, everyCapability, readWatched));
      expect(screen.lines.slice(0, 4)).toEqual([
        "owed",
        "",
        "  refresh in progress…",
        `  ${"░".repeat(29)} 0/0`,
      ]);
      expect(readWatched).toHaveBeenCalledOnce();
    });

    it("counts owed by each repository's own settings once its file arrives", async () => {
      const cache = await openCache(recordedProvider());
      await cache.refresh();
      const year = { amount: 52, unit: "w" } as const;
      const generous = recordedWatched({
        ...recordedSettings,
        targets: {
          nextMove: { response: year, review: year },
          close: { issue: year, pullRequest: year, discussion: year },
        },
      });
      const { promise, resolve } = Promise.withResolvers<WatchedFiles>();
      const screen = await show(viewOf(cache, everyCapability, () => promise));
      expect((await screen.redraw()).lines.at(9)).toBe(
        "2 over · 1 soon · 3 on track",
      );
      resolve({ watched: generous });
      await promise;
      expect((await screen.redraw()).lines.at(9)).toBe(
        "0 over · 0 soon · 6 on track",
      );
    });

    it("stands in GitHub's refusal of gh's token for the list, with no status", async () => {
      const cache = await openCache(recordedProvider());
      await cache.refresh();
      const readRefused = async () => ({
        problem: {
          code: "GH_NOT_SIGNED_IN",
          message: "gh is not signed in to github.com.",
          recovery: "run gh auth login",
        } as const,
      });
      const screen = await (
        await show(viewOf(cache, everyCapability, readRefused))
      ).redraw();
      expect(screen.lines.slice(2, 4)).toEqual([
        "  ✗ gh is not signed in to github.com",
        "  Recovery: run gh auth login",
      ]);
      expect(screen.lines.slice(9, 11)).toEqual(["", ""]);
    });

    it("stands in a failure no code names for the list, with its recovery and no status", async () => {
      const cache = await openCache(recordedProvider());
      await cache.refresh();
      const readFailed = async () => ({
        problem: {
          code: "UNEXPECTED_FAILURE",
          message:
            "docket stopped on a failure it has no name for: disk on fire.",
          recovery: "run the command again; if it keeps failing, report it",
        } as const,
      });
      const screen = await (
        await show(viewOf(cache, everyCapability, readFailed))
      ).redraw();
      expect(screen.lines).toEqual([
        "owed",
        "",
        "  ✗ docket stopped on a failure it has",
        "  no name for: disk on fire",
        "  Recovery: run the command again; if it",
        "  keeps failing, report it",
        "",
        "",
        "",
        "",
        "",
        "←→ mode g grp ?",
      ]);
    });
  });

  describe("with data", () => {
    it("counts owed and leaves the list to its rows, the status dimmed", async () => {
      const cache = await openCache(recordedProvider());
      await cache.refresh();
      const screen = await (await show(viewOf(cache))).redraw();
      expect(screen.lines.slice(9)).toEqual([
        "2 over · 1 soon · 3 on track",
        "synced 0m ago",
        "←→ mode g grp ?",
      ]);
      expect(screen.lines.slice(1, 9).every((line) => line === "")).toBe(true);
      expect(screen.look("synced")?.fg).toBe(tokens["color.text.muted"]);
    });

    it("says nothing is owed when nothing is, at 60 columns", async () => {
      const cache = await openCache(fakeProvider());
      await cache.refresh();
      const screen = await (await show(viewOf(cache), 60)).redraw();
      expect(screen.lines.at(2)).toBe("  nothing owed");
      expect(screen.lines.at(9)).toBe("0 over · 0 soon · 0 on track");
    });

    it("says nothing is owed when no repository is watched", async () => {
      const cache = await openCache(fakeProvider(), []);
      const readNone = async () => ({ watched: [] });
      const view = { ...viewOf(cache, everyCapability, readNone), watched: [] };
      const screen = await (await show(view)).redraw();
      expect(screen.lines.at(2)).toBe("  nothing owed");
    });

    it("reads the clock again as time passes", async () => {
      const cache = await openCache(fakeProvider());
      await cache.refresh();
      let clock = recordedNow;
      const view = { ...viewOf(cache), now: () => clock };
      const screen = await show(view);
      clock = new Date(recordedNow.getTime() + 120_000);
      await new Promise((done) => setTimeout(done, 1_100));
      expect((await screen.redraw()).lines.at(10)).toBe("synced 2m ago");
    });
  });

  describe("keys", () => {
    it("opens on activity when the call asks for it, and switches back to owed", async () => {
      const view = {
        ...viewOf(await openCache(fakeProvider())),
        mode: "activity",
      } as const;
      const screen = await (await show(view)).redraw();
      expect(screen.lines.at(0)).toBe(`activity${" ".repeat(19)}24h · by kind`);
      expect((await press(screen, "left")).lines.at(0)).toBe("owed");
    });

    it("switches mode with the arrows and h and l, naming only the mode shown, and never wraps", async () => {
      const screen = await show(viewOf(await openCache(fakeProvider())));
      expect((await press(screen, "left")).lines.at(0)).toBe("owed");
      const activity = await press(screen, "right");
      expect(activity.lines.at(0)).toBe(
        `activity${" ".repeat(19)}24h · by kind`,
      );
      expect((await press(screen, "right")).lines.at(0)).toMatch(/^activity/);
      expect((await press(screen, "h")).lines.at(0)).toBe("owed");
      expect((await press(screen, "l")).lines.at(0)).toMatch(/^activity/);
    });

    it("steps owed's grouping with g, by stack only with the stack relation", async () => {
      const cache = await openCache(fakeProvider());
      const headers = async (capabilities: ReadonlySet<Capability>) => {
        const screen = await show(viewOf(cache, capabilities));
        const seen = [];
        for (let step = 0; step < 4; step += 1) {
          seen.push(
            (await press(screen, "g")).lines.at(0)?.replace(/^owed */, ""),
          );
        }
        return seen;
      };
      expect(await headers(everyCapability)).toEqual([
        "by owner",
        "by repo",
        "by stack",
        "",
      ]);
      expect(await headers(new Set())).toEqual([
        "by owner",
        "by repo",
        "",
        "by owner",
      ]);
    });

    it("steps activity's grouping and time window, each apart from owed's", async () => {
      const screen = await show(viewOf(await openCache(fakeProvider())));
      await press(screen, "g", "right");
      const address = async (key: string) =>
        (await press(screen, key)).lines.at(0)?.replace(/^activity */, "");
      expect(await address("g")).toBe("24h · by repo");
      expect(await address("g")).toBe("24h");
      expect(await address("t")).toBe("48h");
      expect(await address("g")).toBe("48h · by kind");
      expect((await press(screen, "left")).lines.at(0)).toBe(
        `owed${" ".repeat(28)}by owner`,
      );
    });

    it("leaves the time window alone in owed, and shows its key only in activity", async () => {
      const screen = await show(viewOf(await openCache(fakeProvider())));
      const owed = await press(screen, "t");
      expect(owed.lines.at(0)).toBe("owed");
      expect(owed.lines.at(11)).toBe("←→ mode g grp ?");
      const activity = await press(screen, "right");
      expect(activity.lines.at(11)).toBe("←→ mode g grp t time ?");
      expect(activity.look("t")?.bold).toBe(true);
    });

    it("shows every key with ?, grouped, and hides it again", async () => {
      const screen = await show(viewOf(await openCache(fakeProvider())));
      const help = await press(screen, "?");
      expect(help.lines).toEqual([
        "help",
        "",
        "Mode",
        "  ← →  h l switch mode (owed ↔ activity)",
        "           docket opens owed",
        "  g        next grouping",
        "  t        next time window (activity)",
        "           owed: most overdue first",
        "           activity: newest first",
        "",
        "App",
        "  ?        show or hide help",
      ]);
      expect((await press(screen, "?")).lines.at(0)).toBe("owed");
    });

    it("discards the cache and fetches everything again with R", async () => {
      const snapshot = vi.fn(fakeProvider().snapshot);
      const cache = await openCache(fakeProvider({ snapshot }));
      await cache.refresh();
      const screen = await show(viewOf(cache));
      snapshot.mockClear();
      await press(screen, "R");
      await vi.waitFor(() => expect(snapshot).toHaveBeenCalledTimes(2));
      expect(snapshot.mock.calls.map(([, cursor]) => cursor)).toEqual([
        null,
        null,
      ]);
    });

    it("quits with q", async () => {
      const onQuit = vi.fn();
      const screen = await show(
        viewOf(await openCache(fakeProvider())),
        40,
        onQuit,
      );
      await press(screen, "q");
      expect(onQuit).toHaveBeenCalledOnce();
    });
  });

  describe("width", () => {
    it("shows only that it needs 40 columns when narrowed, and the screen again when widened", async () => {
      const screen = await show(viewOf(await openCache(fakeProvider())));
      screen.setup.resize(30, 12);
      const narrow = await screen.redraw();
      expect(narrow.lines.filter(Boolean)).toEqual(["docket needs 40 columns"]);
      screen.setup.resize(60, 12);
      const wide = await screen.redraw();
      expect(wide.lines.at(0)).toBe("owed");
      expect(wide.lines.at(11)).toBe("←→ mode g grp ?");
    });
  });
});
