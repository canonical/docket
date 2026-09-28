// Longer than 500 lines because the one screen is tested here whole, through the keys its one layer binds, on a cache of the recording.
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { type Cache, createCache } from "../lib/cache/index.js";
import type {
  Capability,
  Provider,
  ThreadDetail,
} from "../lib/provider/index.js";
import { tokens } from "../lib/tokens/index.js";
import type { ThreadSummary } from "../lib/waits/index.js";
import {
  everyCapability,
  fakeProvider,
  fullBudget,
  providerError,
} from "../testing/provider.js";
import {
  parserFixDetail,
  recordedNow,
  recordedProvider,
  recordedRepos,
  recordedSettings,
  recordedWatched,
} from "../testing/recorded.js";
import {
  type Screen as Drawn,
  draw,
  drawSuspending,
  WithKeys,
} from "../testing/terminal.js";
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

/** Reads every thread's details as the recording's pull request's. */
const readRecordedDetail = async () => parserFixDetail;

/** Opens nothing, and says it opened. */
const openNothing = async (_url: string) => {};

function viewOf(
  cache: Cache,
  capabilities: ReadonlySet<Capability> = everyCapability,
  readWatched = readRecorded,
  readDetail: (
    thread: ThreadSummary,
  ) => Promise<ThreadDetail> = readRecordedDetail,
  openInBrowser = openNothing,
): TerminalView {
  return {
    mode: "owed",
    owedGrouping: "none",
    now: () => recordedNow,
    openInBrowser,
    settings: recordedSettings,
    watched: recordedWatched(),
    source: {
      cache,
      capabilities,
      readWatched,
      readDetail,
      readEvents: (repo, since) => cache.readEvents(repo, since, 300_000),
    },
  };
}

function show(view: TerminalView, width = 40, onQuit = () => {}, height = 12) {
  return drawSuspending(
    <WithKeys>
      <Screen {...view} onQuit={onQuit} />
    </WithKeys>,
    width,
    height,
  );
}

/** Presses `keys` one after another and reads the screen back. */
async function press(screen: Drawn, ...keys: string[]) {
  let drawn = screen;
  for (const key of keys) {
    drawn = await drawn.redraw(() => {
      if (key === "left" || key === "right" || key === "up" || key === "down") {
        screen.setup.mockInput.pressArrow(key);
      } else if (key === "return") {
        screen.setup.mockInput.pressEnter();
      } else {
        screen.setup.mockInput.pressKey(key);
      }
    });
  }
  return drawn;
}

/**
 * The screen on the recording, its data in, with `readDetail` for the
 * accordion and `openInBrowser` for a thread's page.
 */
async function showRecorded(
  readDetail: (
    thread: ThreadSummary,
  ) => Promise<ThreadDetail> = readRecordedDetail,
  openInBrowser = openNothing,
) {
  const cache = await openCache(recordedProvider());
  await cache.refresh();
  const view = viewOf(
    cache,
    everyCapability,
    readRecorded,
    readDetail,
    openInBrowser,
  );
  return (await show(view)).redraw();
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
        "←→ mode ↑↓ sel ⏎ open g grp ?",
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
        owedGrouping: "none",
        now: () => recordedNow,
        openInBrowser: openNothing,
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
        "←→ mode ↑↓ sel ⏎ open g grp ?",
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
        "←→ mode ↑↓ sel ⏎ open g grp ?",
      ]);
    });
  });

  describe("with data", () => {
    it("lists owed's rows with the first selected and its details open, counted, the status dimmed", async () => {
      const cache = await openCache(recordedProvider());
      await cache.refresh();
      const screen = await (await show(viewOf(cache))).redraw();
      expect(screen.lines).toEqual([
        "owed",
        `▌┃example#12 reply${" ".repeat(15)}4d over`,
        " ┃Fix the parser · alice ✗ checks",
        "  dave · 3d ago",
        "  Rebased on main. Could someone look",
        "  again?",
        "  example stack 3 · 2 of 3 · → main",
        "  below #11 merged, above #13 open",
        "",
        "2 over · 1 soon · 3 on track",
        "synced 0m ago",
        "←→ mode ↑↓ sel ⏎ open g grp ?",
      ]);
      expect(screen.look("example#12 reply")?.bg).toBe(
        tokens["color.background.selected"],
      );
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

  describe("the selection", () => {
    it("moves down with j and ↓ and up with k and ↑, scrolling the list, never past either end", async () => {
      const screen = await showRecorded();
      const down = await press(screen, "j");
      expect(down.lines.slice(1, 4)).toEqual([
        `▌┃example#12 close${" ".repeat(15)}2h over`,
        " ┃Fix the parser · alice ✗ checks",
        "  age 7d · owner alice",
      ]);
      expect(down.lines.join("\n")).not.toContain("example#12 reply");
      expect(down.look("example#12 close")?.bg).toBe(
        tokens["color.background.selected"],
      );
      const back = await press(screen, "up");
      expect(back.lines.at(1)).toBe(
        `▌┃example#12 reply${" ".repeat(15)}4d over`,
      );
      expect((await press(screen, "k")).lines.at(1)).toBe(back.lines.at(1));
      const last = await press(screen, "down", "j", "j", "j", "j", "j");
      expect(last.lines.at(1)).toBe(
        `▌ example#15 close${" ".repeat(14)}29d left`,
      );
    });

    it("stays on its wait when the grouping changes, and never lands on a heading", async () => {
      const screen = await showRecorded();
      const grouped = await press(screen, "j", "g");
      expect(grouped.lines.slice(0, 2)).toEqual([
        `owed${" ".repeat(28)}by owner`,
        `▌┃example#12 close${" ".repeat(15)}2h over`,
      ]);
      const first = await press(screen, "k");
      expect(first.lines.slice(1, 3)).toEqual([
        "alice",
        `▌┃example#12 reply${" ".repeat(15)}4d over`,
      ]);
      expect(first.look("alice")?.bg).not.toBe(
        tokens["color.background.selected"],
      );
      expect((await press(screen, "k")).lines.slice(1, 3)).toEqual(
        first.lines.slice(1, 3),
      );
    });

    it("keeps owed's selection while activity is shown, where the keys move nothing", async () => {
      const screen = await showRecorded();
      const activity = await press(screen, "l", "j");
      expect(activity.lines.join("\n")).not.toContain("▌");
      expect(activity.lines.at(11)).toBe("←→ mode g grp t time ?");
      const owed = await press(screen, "h");
      expect(owed.lines.at(1)).toBe(
        `▌┃example#12 reply${" ".repeat(15)}4d over`,
      );
    });

    it("reads a thread's details once, however often the selection returns to it", async () => {
      const readDetail = vi.fn(
        async (_thread: ThreadSummary) => parserFixDetail,
      );
      const screen = await showRecorded(readDetail);
      await press(screen, "j", "j", "k", "k");
      expect(readDetail.mock.calls.map(([thread]) => thread.number)).toEqual([
        12, 15,
      ]);
    });

    it("reads a thread's details again when the selection comes back after they failed, never while it stays", async () => {
      const readDetail = vi.fn(
        async (_thread: ThreadSummary) => parserFixDetail,
      );
      readDetail.mockRejectedValueOnce(providerError("GITHUB_TIMED_OUT"));
      const screen = await showRecorded(readDetail);
      await new Promise((done) => setTimeout(done, 1_100));
      const failed = await screen.redraw();
      expect(failed.lines.at(3)).toBe("  ✗ failed: The provider failed with");
      expect(readDetail).toHaveBeenCalledOnce();
      const back = await press(screen, "j", "j", "k", "k");
      expect(back.lines.at(3)).toBe("  dave · 3d ago");
      expect(readDetail.mock.calls.map(([thread]) => thread.number)).toEqual([
        12, 15, 12,
      ]);
    });
  });

  describe("opening a thread", () => {
    it("opens the selected row's page, as GitHub gives it, with ⏎, and never a heading", async () => {
      const opened: string[] = [];
      const screen = await showRecorded(readRecordedDetail, async (url) => {
        opened.push(url);
      });
      await press(screen, "j", "j", "return");
      await press(screen, "g", "k", "k", "k", "k", "return");
      expect(opened).toEqual([
        "https://github.com/example-org/example-repo/issues/15",
        "https://github.com/example-org/example-repo/pull/12",
      ]);
    });

    it("says on the status line, in the error colour, when the browser cannot be opened", async () => {
      const screen = await showRecorded(readRecordedDetail, () =>
        Promise.reject(new Error("xdg-open exited with code 3")),
      );
      await press(screen, "return");
      const failed = await screen.redraw();
      expect(failed.lines.at(10)).toBe("✗ could not open the browser");
      expect(failed.look("✗ could")?.fg).toBe(tokens["color.text.error"]);
    });

    it("opens nothing in activity, where nothing is selected", async () => {
      const open = vi.fn(openNothing);
      const screen = await showRecorded(readRecordedDetail, open);
      await press(screen, "l", "return");
      expect(open).not.toHaveBeenCalled();
    });

    it("opens nothing when nothing is owed", async () => {
      const open = vi.fn(openNothing);
      const cache = await openCache(fakeProvider());
      await cache.refresh();
      const view = { ...viewOf(cache), openInBrowser: open };
      await press(await (await show(view)).redraw(), "return");
      expect(open).not.toHaveBeenCalled();
    });
  });

  describe("activity", () => {
    /** Opens the recording's activity on a pane 16 lines tall. */
    async function showActivity(width: number, cache?: Cache) {
      const opened = cache ?? (await openCache(recordedProvider()));
      await opened.refresh();
      const view = { ...viewOf(opened), mode: "activity" } as const;
      const screen = await draw(
        <WithKeys>
          <Screen {...view} onQuit={() => {}} />
        </WithKeys>,
        width,
        16,
      );
      await vi.waitFor(async () =>
        expect((await screen.redraw()).lines.slice(1, 3).join("")).not.toBe(""),
      );
      return screen.redraw();
    }

    it("lists each thread with its events under it, by kind, and counts them at 40 columns", async () => {
      const screen = await showActivity(40);
      expect(screen.lines).toEqual([
        `activity${" ".repeat(19)}24h · by kind`,
        "ISSUES",
        "  docs#4 issue                       16h",
        "  Where do tokens live?",
        "  alice, bob",
        "    example-sync labelled kind=docs  16h",
        "PULL REQUESTS",
        " ┃example#12 PR                      25m",
        " ┃Fix the parser · alice",
        "    ✗ checks failed (lint)           25m",
        "    alice requested review            3h",
        "",
        "",
        "2 threads · 3 events",
        "synced 0m ago",
        "←→ mode g grp t time ?",
      ]);
    });

    it("regroups with g and reaches further back with t, at 60 columns", async () => {
      const screen = await showActivity(60);
      const byRepo = await press(screen, "g");
      expect(byRepo.lines.slice(0, 2)).toEqual([
        `activity${" ".repeat(39)}24h · by repo`,
        "example",
      ]);
      const wider = await press(screen, "g", "t");
      await vi.waitFor(async () =>
        expect((await screen.redraw()).lines.at(13)).toBe(
          "2 threads · 4 events",
        ),
      );
      expect(wider.lines.at(0)).toBe(`activity${" ".repeat(49)}48h`);
      expect((await screen.redraw()).lines.at(5)).toBe(
        `    dave commented${" ".repeat(40)}3d`,
      );
    });

    it("stands the failure in for the list when no events are held for the window", async () => {
      const cache = await openCache(
        recordedProvider({
          events: () => Promise.reject(providerError("GITHUB_TIMED_OUT")),
        }),
      );
      const screen = await showActivity(40, cache);
      expect(screen.lines.slice(1, 3)).toEqual([
        "",
        "  ✗ The provider failed with",
      ]);
      expect(screen.lines.at(13)).toBe("");
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

    it("opens owed on the grouping the call names, ungrouped when that is by stack with no stacks", async () => {
      const cache = await openCache(fakeProvider());
      const byOwner = { ...viewOf(cache), owedGrouping: "owner" } as const;
      expect((await show(byOwner)).lines.at(0)).toBe(
        `owed${" ".repeat(28)}by owner`,
      );
      const withoutStacks = new Set(
        [...everyCapability].filter((each) => each !== "stacks"),
      );
      const byStack = {
        ...viewOf(cache, withoutStacks),
        owedGrouping: "stack",
      } as const;
      expect((await show(byStack)).lines.at(0)).toBe("owed");
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
      expect(owed.lines.at(11)).toBe("←→ mode ↑↓ sel ⏎ open g grp ?");
      const activity = await press(screen, "right");
      expect(activity.lines.at(11)).toBe("←→ mode g grp t time ?");
      expect(activity.look("t")?.bold).toBe(true);
    });

    it("shows every key with ?, grouped, and hides it again", async () => {
      const view = viewOf(await openCache(fakeProvider()));
      const screen = await show(view, 40, () => {}, 24);
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
        "List",
        "  ↑ ↓  k j move the selection",
        "           (opens the accordion)",
        "",
        "Thread",
        "  ⏎        open in the browser",
        "",
        "App",
        "  ?        show or hide help",
        "  R        full refresh",
        "  q        quit",
        "",
        "  windows are counted in working time",
        "",
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

  describe("height", () => {
    it("shows the rows scrolled out above once the pane grows tall enough", async () => {
      const screen = await showRecorded();
      const short = await press(screen, "j");
      expect(short.lines.at(1)).toBe(
        `▌┃example#12 close${" ".repeat(15)}2h over`,
      );
      screen.setup.resize(40, 30);
      const tall = await screen.redraw();
      expect(tall.lines.slice(1, 4)).toEqual([
        `▌┃example#12 reply${" ".repeat(15)}4d over`,
        " ┃Fix the parser · alice ✗ checks",
        `▌┃example#12 close${" ".repeat(15)}2h over`,
      ]);
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
      expect(wide.lines.at(11)).toBe("←→ mode ↑↓ sel ⏎ open g grp ?");
    });
  });
});
