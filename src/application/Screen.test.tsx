// Longer than 500 lines because the one screen is tested here whole, through the keys its one layer binds, on a cache of the recording.
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { type Cache, createCache } from "../lib/cache/index.js";
import type { ThreadEvent } from "../lib/events/index.js";
import type {
  Capability,
  Provider,
  ThreadDetail,
} from "../lib/provider/index.js";
import { tokens } from "../lib/tokens/index.js";
import {
  findWaits,
  type Thread,
  type ThreadSummary,
} from "../lib/waits/index.js";
import { pendingDetail } from "../testing/details.js";
import { bob } from "../testing/facts.js";
import {
  everyCapability,
  fakeProvider,
  fullBudget,
  providerError,
} from "../testing/provider.js";
import {
  crash,
  parserFix,
  parserFixDetail,
  recordedEvents,
  recordedNow,
  recordedProvider,
  recordedRepos,
  recordedSettings,
  recordedThreads,
  recordedWatched,
  tokensGuide,
} from "../testing/recorded.js";
import {
  type Screen as Drawn,
  draw,
  drawSuspending,
  WithKeys,
} from "../testing/terminal.js";
import { waitUntil } from "../testing/wait.js";
import readCandidates from "./readCandidates.js";
import Screen from "./Screen.js";
import type { TerminalMode, TerminalView, WatchedFiles } from "./types.js";
import writeFromTerminal from "./writeFromTerminal.js";
import type { WriteAction, WriteRequest } from "./writeSet.js";

// The measuring of waits is watched, not replaced, to see which threads a
// redraw measures.
vi.mock("../lib/waits/index.js", async (importOriginal) => {
  const waits = await importOriginal<typeof import("../lib/waits/index.js")>();
  return { ...waits, findWaits: vi.fn(waits.findWaits) };
});

const folders: string[] = [];
afterEach(async () => {
  vi.useRealTimers();
  for (const folder of folders.splice(0)) {
    await rm(folder, { recursive: true, force: true });
  }
});

/**
 * A cache of the recording's repositories in a folder of its own, read
 * at `now`.
 */
async function openCache(
  provider: Provider,
  repos = recordedRepos,
  now = () => recordedNow,
) {
  const directory = await mkdtemp(join(tmpdir(), "docket-screen-"));
  folders.push(directory);
  return createCache({
    provider,
    repos: repos.map(({ repo }) => repo),
    directory,
    now,
  });
}

/** Reads the repositories' files as the recording's settings. */
const readRecorded = async (): Promise<WatchedFiles> => ({
  watched: recordedWatched(),
});

/**
 * Reads every thread's details as the recording's pull request's, with the
 * thread's own age, labels and assignees when the recording holds it.
 */
const readRecordedDetail = async (
  thread: ThreadSummary,
): Promise<ThreadDetail> => {
  const facts = recordedThreads.find(
    ({ repo, number }) => repo === thread.repo && number === thread.number,
  );
  if (!facts) return parserFixDetail;
  const { createdAt, labels, assignees } = facts;
  return { ...parserFixDetail, createdAt, labels, assignees };
};

/** Opens nothing, and says it opened. */
const openNothing = async (_url: string) => {};

/**
 * The editors' reading and writing, as the terminal wires them, on
 * `provider` and the cache.
 */
function wireEdits(cache: Cache, provider: Provider = recordedProvider()) {
  return {
    readCandidates: (action: WriteAction, thread: Thread) =>
      readCandidates(provider, action, thread),
    write: (
      request: Pick<WriteRequest, "action" | "thread" | "reference" | "wanted">,
    ) => writeFromTerminal({ provider, cache }, request),
  };
}

function viewOf(
  cache: Cache,
  capabilities: ReadonlySet<Capability> = everyCapability,
  readWatched = readRecorded,
  readDetail: (
    thread: ThreadSummary,
  ) => Promise<ThreadDetail> = readRecordedDetail,
  openInBrowser = openNothing,
  edits = wireEdits(cache),
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
      readViewer: async () => "alice",
      readDetail,
      readEvents: (repo, since) => cache.readEvents(repo, since, 300_000),
      ...edits,
    },
  };
}

/** The cache and readings a view reads from. */
function cacheSourceOf({ source }: TerminalView) {
  if (!("cache" in source)) throw new Error("the view reads a cache");
  return source;
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

/**
 * What the terminal sends for a key the mock input names no helper for:
 * the page keys as their escape sequences, home and end by their names.
 */
const sequences: Readonly<Record<string, string>> = {
  pageup: "\u001B[5~",
  pagedown: "\u001B[6~",
  home: "HOME",
  end: "END",
};

/** Presses `keys` one after another and reads the screen back. */
async function press(screen: Drawn, ...keys: string[]) {
  let drawn = screen;
  for (const key of keys) {
    drawn = await drawn.redraw(() => {
      if (key === "left" || key === "right" || key === "up" || key === "down") {
        screen.setup.mockInput.pressArrow(key);
      } else if (key === "return") {
        screen.setup.mockInput.pressEnter();
      } else if (key === "escape") {
        screen.setup.mockInput.pressEscape();
      } else {
        screen.setup.mockInput.pressKey(sequences[key] ?? key);
      }
    });
    // The input reads a lone escape only once no sequence follows it.
    if (key === "escape") {
      await new Promise((resolve) => setTimeout(resolve, 50));
      drawn = await drawn.redraw();
    }
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

/**
 * The screen on a cache whose snapshots give the open threads of
 * `threads`, and whose events are `events`, as they stand at each
 * refresh, with `readDetail` for the accordion, opened on `mode`.
 * `refresh` moves the clock on three minutes, so the data is old enough
 * to fetch again, refreshes, and reads the screen back.
 */
async function showRefreshing(
  readDetail: (thread: ThreadSummary) => Promise<ThreadDetail>,
  threads: () => readonly Thread[] = () => recordedThreads,
  mode: TerminalMode = "owed",
  events: () => readonly ThreadEvent[] = () => recordedEvents,
) {
  let clock = recordedNow;
  const provider = recordedProvider({
    snapshot: async (repo) => ({
      threads: threads().filter((thread) => thread.repo === repo),
      cursor: { since: "2026-09-28T09:59:00Z" },
    }),
    events: async (repo) =>
      events().filter(({ thread }) => thread.repo === repo),
  });
  const cache = await openCache(provider, recordedRepos, () => clock);
  await cache.refresh();
  const view = {
    ...viewOf(cache, everyCapability, readRecorded, readDetail),
    mode,
  };
  const screen = await (await show(view)).redraw();
  const refresh = async () => {
    clock = new Date(clock.getTime() + 180_000);
    await act(() => cache.refresh());
    return screen.redraw();
  };
  return { screen, cache, refresh };
}

// Each test draws the whole screen, with the keymap, on a cache, some of
// them tens of times: at most 0.5 s each at a load average of 50, and at
// most 5.1 s over 30 runs at a load average of 88 to 112, past vitest's
// default of 5 s.
describe("Screen", { timeout: 15_000 }, () => {
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
        "←→ mode ↑↓ sel ⏎ open g grp a r ?",
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
      await waitUntil(() => expect(cache.status().fullRefresh).toBeDefined());
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
        "←→ mode ↑↓ sel ⏎ open g grp a r ?",
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
        "←→ mode ↑↓ sel ⏎ open g grp a r ?",
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
        "←→ mode ↑↓ sel ⏎ open g grp a r ?",
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

    it("opens owed with the notice while no team is listed, the rows below it, and activity without it", async () => {
      const cache = await openCache(recordedProvider());
      await cache.refresh();
      const teamless = { ...recordedSettings, people: new Map() };
      const readTeamless = async () => ({
        watched: recordedWatched(teamless),
      });
      const view = {
        ...viewOf(cache, everyCapability, readTeamless),
        settings: teamless,
      };
      const screen = await show(view, 40, () => {}, 17);
      const owed = await vi.waitFor(async () => {
        const drawn = await screen.redraw();
        expect(drawn.lines.at(7)).toMatch(/^▌ docs#4 reply/);
        return drawn;
      });
      expect(owed.lines.slice(1, 7)).toEqual([
        "  ✗ no team in docket.yaml, so every",
        "  comment starts a reply wait",
        "  Recovery: list the team under people:",
        "  in the personal file or the",
        "  repository's .github/docket.yaml, then",
        "  run docket config",
      ]);
      await press(screen, "right");
      expect((await screen.redraw()).lines.join("\n")).not.toContain("no team");
    });

    it.each([
      [
        16,
        [
          "▌ docs#4 reply                  18d over",
          "  Where do tokens live?",
          "  alice, bob",
          "  dave · 3d ago",
          "  Rebased on main. Could someone look",
          "  again?",
        ],
      ],
      [
        14,
        [
          "▌ docs#4 reply                  18d over",
          "  Where do tokens live?",
          "  alice, bob",
          "  dave · 3d ago",
        ],
      ],
    ])(
      "keeps the notice whole above the selected row, cut below it, at 40 by %i",
      async (height, rows) => {
        const cache = await openCache(recordedProvider());
        await cache.refresh();
        const teamless = { ...recordedSettings, people: new Map() };
        const readTeamless = async () => ({
          watched: recordedWatched(teamless),
        });
        const view = {
          ...viewOf(cache, everyCapability, readTeamless),
          settings: teamless,
        };
        const screen = await show(view, 40, () => {}, height);
        const owed = await vi.waitFor(async () => {
          const drawn = await screen.redraw();
          expect(drawn.lines.at(7)).toMatch(/^▌ docs#4 reply/);
          return drawn;
        });
        expect(owed.lines.slice(1, height - 3)).toEqual([
          "  ✗ no team in docket.yaml, so every",
          "  comment starts a reply wait",
          "  Recovery: list the team under people:",
          "  in the personal file or the",
          "  repository's .github/docket.yaml, then",
          "  run docket config",
          ...rows,
        ]);
        expect(owed.lines.at(height - 3)).toMatch(/^\d+ over/);
      },
    );

    it("keeps the notice above nothing owed while no team is listed", async () => {
      const cache = await openCache(fakeProvider());
      await cache.refresh();
      const teamless = { ...recordedSettings, people: new Map() };
      const view = {
        ...viewOf(cache, everyCapability, async () => ({
          watched: recordedWatched(teamless),
        })),
        settings: teamless,
        watched: recordedWatched(teamless),
      };
      const screen = await (await show(view, 60)).redraw();
      expect(screen.lines.slice(2, 8)).toEqual([
        "  ✗ no team in docket.yaml, so every comment starts a reply",
        "  wait",
        "  Recovery: list the team under people: in the personal file",
        "  or the repository's .github/docket.yaml, then run",
        "  docket config",
        "  nothing owed",
      ]);
    });

    it("drops the notice once every repository's own file lists a team the personal file leaves out", async () => {
      const cache = await openCache(recordedProvider());
      await cache.refresh();
      const teamless = { ...recordedSettings, people: new Map() };
      const view = {
        ...viewOf(cache),
        settings: teamless,
        watched: recordedWatched(teamless),
      };
      const screen = await show(view, 60, () => {}, 16);
      await vi.waitFor(async () => {
        const drawn = await screen.redraw();
        expect(drawn.lines.at(1)).toMatch(/^▌┃example#12 reply/);
      });
    });

    it("shows the notice while a repository's own file lists no team, though the personal file lists one", async () => {
      const cache = await openCache(recordedProvider());
      await cache.refresh();
      const people = new Map([["carol", "internal" as const]]);
      const readDeclared = async () => ({
        watched: [
          ...recordedWatched().slice(0, 1),
          ...recordedWatched({ ...recordedSettings, people }).slice(1),
        ],
      });
      const screen = await show(
        viewOf(cache, everyCapability, readDeclared),
        60,
        () => {},
        16,
      );
      const owed = await vi.waitFor(async () => {
        const drawn = await screen.redraw();
        expect(drawn.lines.at(1)).toMatch(/^ {2}✗ no team/);
        return drawn;
      });
      expect(owed.lines.slice(1, 3)).toEqual([
        "  ✗ no team in docket.yaml, so every comment starts a reply",
        "  wait",
      ]);
      expect(owed.lines.join("\n")).toMatch(/docs#4 reply/);
    });

    it("says nothing is owed when no repository is watched", async () => {
      const cache = await openCache(fakeProvider(), []);
      const readNone = async () => ({ watched: [] });
      const view = { ...viewOf(cache, everyCapability, readNone), watched: [] };
      const screen = await (await show(view)).redraw();
      expect(screen.lines.at(2)).toBe("  nothing owed");
    });

    it("shows the cached rows, the status naming the failure, when GitHub cannot say whom gh is signed in as", async () => {
      const cache = await openCache(recordedProvider());
      await cache.refresh();
      const view = viewOf(cache);
      const source = {
        ...cacheSourceOf(view),
        readViewer: () => Promise.reject(providerError("GITHUB_UNREACHABLE")),
      };
      const screen = await show({ ...view, source });
      await vi.waitFor(async () =>
        expect((await screen.redraw()).lines.at(10)).toBe(
          "✗ offline · data from 12:00",
        ),
      );
      expect((await screen.redraw()).lines.at(1)).toMatch(
        /^▌┃example#12 reply/,
      );
    });

    it("reads the clock again as time passes", async () => {
      vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
      const cache = await openCache(fakeProvider());
      await cache.refresh();
      let clock = recordedNow;
      const view = { ...viewOf(cache), now: () => clock };
      const screen = await show(view);
      clock = new Date(recordedNow.getTime() + 120_000);
      expect((await screen.redraw()).lines.at(10)).toBe("synced 0m ago");
      const ticked = await screen.redraw(() => vi.advanceTimersByTime(1_000));
      expect(ticked.lines.at(10)).toBe("synced 2m ago");
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

    it("moves a page at a time, as many rows as the list shows, never past either end", async () => {
      const short = await showRecorded();
      expect((await press(short, "pagedown")).lines.at(1)).toBe(
        `▌┃example#12 close${" ".repeat(15)}2h over`,
      );
      const cache = await openCache(recordedProvider());
      await cache.refresh();
      const tall = await (await show(viewOf(cache), 40, () => {}, 20)).redraw();
      const screen = await press(tall, "g");
      expect(screen.lines.slice(1, 3)).toEqual([
        "alice",
        `▌┃example#12 reply${" ".repeat(15)}4d over`,
      ]);
      // alice's three rows fill the screen, bob's heading below them.
      const page = await press(screen, "pagedown");
      expect(page.lines.slice(8, 10)).toEqual([
        "bob",
        `▌ docs#4 close${" ".repeat(18)}10d left`,
      ]);
      expect(page.look("bob")?.bg).not.toBe(
        tokens["color.background.selected"],
      );
      const last = await press(screen, "pagedown", "pagedown");
      expect(last.lines.slice(10, 12)).toEqual([
        `▌ example#15 close${" ".repeat(14)}29d left`,
        "  Crash on start · unassigned",
      ]);
      expect(last.lines.at(12)).toBe("  age 2d · owner unassigned");
      const first = await press(screen, "pageup", "pageup", "pageup");
      expect(first.lines.slice(1, 5)).toEqual([
        "alice",
        `▌┃example#12 reply${" ".repeat(15)}4d over`,
        " ┃Fix the parser · alice ✗ checks",
        "  dave · 3d ago",
      ]);
    });

    it("moves to the last thread with end and the first with home", async () => {
      const screen = await showRecorded();
      const last = await press(screen, "end");
      expect(last.lines.slice(1, 3)).toEqual([
        `▌ example#15 close${" ".repeat(14)}29d left`,
        "  Crash on start · unassigned",
      ]);
      expect((await press(screen, "end")).lines.at(1)).toBe(last.lines.at(1));
      const first = await press(screen, "home");
      expect(first.lines.at(1)).toBe(
        `▌┃example#12 reply${" ".repeat(15)}4d over`,
      );
      expect((await press(screen, "home")).lines.at(1)).toBe(first.lines.at(1));
    });

    it("leaves the selection where it is when a page or end key is pressed in an editor", async () => {
      const screen = await showRecorded();
      const assigning = await press(screen, "a");
      expect(assigning.lines.at(0)).toBe("assigning example#12");
      await press(screen, "pagedown", "end");
      const closed = await press(screen, "escape");
      expect(closed.lines.at(1)).toBe(
        `▌┃example#12 reply${" ".repeat(15)}4d over`,
      );
    });

    it("acts on nothing the help hides, and every key acts again once it closes", async () => {
      const provider = recordedProvider();
      const snapshot = vi.fn(provider.snapshot);
      const cache = await openCache({ ...provider, snapshot });
      await cache.refresh();
      const open = vi.fn(openNothing);
      const view = { ...viewOf(cache), openInBrowser: open };
      const screen = await (await show(view)).redraw();
      const before = screen.lines;
      snapshot.mockClear();
      await press(screen, "?");
      await press(
        screen,
        ...["up", "k", "down", "j", "pageup", "pagedown", "home", "end"],
        ...["return", "a", "r", "g", "t", "left", "h", "right", "l", "R"],
      );
      const closed = await press(screen, "?");
      expect(closed.lines).toEqual(before);
      expect(open).not.toHaveBeenCalled();
      expect(snapshot).not.toHaveBeenCalled();
      await press(screen, "right", "?", "t", "g", "escape");
      expect((await screen.redraw()).lines.at(0)).toBe(
        `activity${" ".repeat(19)}24h · by kind`,
      );
      const moved = await press(screen, "left", "j");
      expect(moved.lines.at(1)).toBe(
        `▌┃example#12 close${" ".repeat(15)}2h over`,
      );
    });

    it("keeps a selection for each mode, so switching back finds it where it was", async () => {
      const screen = await showRecorded();
      await press(screen, "j", "l");
      const activity = await waitUntil(async () => {
        const drawn = await screen.redraw();
        expect(drawn.lines.at(1)).toContain("docs#4");
        return drawn;
      });
      expect(activity.look("docs#4")?.bg).toBe(
        tokens["color.background.selected"],
      );
      const owed = await press(screen, "h");
      expect(owed.lines.at(1)).toBe(
        `▌┃example#12 close${" ".repeat(15)}2h over`,
      );
    });

    it("stays on nothing owed whichever key moves the selection", async () => {
      const cache = await openCache(fakeProvider());
      await cache.refresh();
      const screen = await (await show(viewOf(cache))).redraw();
      const moved = await press(screen, "j", "k", "pagedown", "end", "home");
      expect(moved.lines.at(2)).toBe("  nothing owed");
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
      vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
      const cache = await openCache(recordedProvider());
      await cache.refresh();
      // A new `Date` on each read, so the clock's tick draws a frame: the
      // same object again leaves the screen as it was.
      const view = {
        ...viewOf(cache, everyCapability, readRecorded, readDetail),
        now: () => new Date(recordedNow),
      };
      const screen = await (await show(view)).redraw();
      const failure = "  ✗ failed: The provider failed with";
      await waitUntil(async () =>
        expect((await screen.redraw()).lines.at(3)).toBe(failure),
      );
      // The tick draws the screen again, with the selection where it was.
      const ticked = await screen.redraw(() => vi.advanceTimersByTime(1_000));
      expect(ticked.lines.at(3)).toBe(failure);
      expect(readDetail).toHaveBeenCalledOnce();
      const back = await press(screen, "j", "j", "k", "k");
      expect(back.lines.at(3)).toBe("  dave · 3d ago");
      expect(readDetail.mock.calls.map(([thread]) => thread.number)).toEqual([
        12, 15, 12,
      ]);
    });
  });

  describe("a refresh", () => {
    /** Reads every thread's details as a read that never arrives. */
    const readForever = () =>
      vi.fn((_thread: ThreadSummary): Promise<ThreadDetail> => pendingDetail);

    /**
     * Ten frames as the renderer draws them, a millisecond apart, read
     * outside React's act, which would settle every update before a frame
     * is read.
     */
    const drawFrames = async (screen: Drawn) => {
      const frames: string[] = [];
      for (let frame = 0; frame < 10; frame += 1) {
        await new Promise((done) => setTimeout(done, 1));
        await screen.setup.renderOnce();
        frames.push(screen.setup.captureCharFrame());
      }
      return frames.join("\n");
    };

    /** The numbers of the threads `readDetail` has read, in order. */
    const readNumbers = (readDetail: ReturnType<typeof readForever>) =>
      readDetail.mock.calls.map(([thread]) => thread.number);

    it("keeps the selected thread's details on screen, read once, when a refresh brings a new copy of the data", async () => {
      const readDetail = readForever();
      readDetail.mockResolvedValueOnce(parserFixDetail);
      const { screen, cache, refresh } = await showRefreshing(readDetail);
      expect(screen.lines.at(3)).toBe("  dave · 3d ago");
      const before = cache.threads();
      const refreshed = await refresh();
      expect(cache.threads()).not.toBe(before);
      expect(refreshed.lines.at(3)).toBe("  dave · 3d ago");
      expect(readNumbers(readDetail)).toEqual([12]);
    });

    it("reads a thread's details again once GitHub records a change to it, showing the earlier ones until the new arrive", async () => {
      let threads = recordedThreads;
      const { promise, resolve } = Promise.withResolvers<ThreadDetail>();
      const readDetail = readForever();
      readDetail.mockResolvedValueOnce(parserFixDetail);
      readDetail.mockReturnValueOnce(promise);
      const { screen, refresh } = await showRefreshing(
        readDetail,
        () => threads,
      );
      threads = [
        { ...parserFix, updatedAt: new Date("2026-09-28T11:50+02:00") },
        crash,
        tokensGuide,
      ];
      const changing = await refresh();
      expect(changing.lines.at(3)).toBe("  dave · 3d ago");
      expect(readNumbers(readDetail)).toEqual([12, 12]);
      const reply = {
        author: bob,
        at: new Date("2026-09-28T11:50+02:00"),
        body: "Merging it.",
      };
      resolve({
        ...parserFixDetail,
        messages: [...parserFixDetail.messages, reply],
      });
      expect(await drawFrames(screen)).not.toContain("loading…");
      const changed = await screen.redraw();
      expect(changed.lines.slice(3, 5)).toEqual([
        "  bob · 10m ago",
        "  Merging it.",
      ]);
      await refresh();
      expect(readNumbers(readDetail)).toEqual([12, 12]);
    });

    it("shows a review's finished checks once a refresh brings them, though GitHub records no change to the thread", async () => {
      let threads: readonly Thread[] = [
        { ...parserFix, checks: "running" },
        crash,
        tokensGuide,
      ];
      const { promise, resolve } = Promise.withResolvers<ThreadDetail>();
      const readDetail = readForever();
      readDetail.mockResolvedValueOnce({
        ...parserFixDetail,
        checks: [
          { name: "lint", state: "running" },
          { name: "test", state: "passing" },
        ],
      });
      readDetail.mockResolvedValue(parserFixDetail);
      const { screen, refresh } = await showRefreshing(
        readDetail,
        () => threads,
      );
      const running = await press(screen, "j", "j", "j", "j");
      expect(running.lines).toContain("  checks running 1 of 2");
      readDetail.mockReturnValueOnce(promise);
      threads = [{ ...parserFix, checks: "passing" }, crash, tokensGuide];
      const finishing = await refresh();
      expect(finishing.lines).toContain("  checks running 1 of 2");
      resolve({
        ...parserFixDetail,
        checks: [
          { name: "lint", state: "passing" },
          { name: "test", state: "passing" },
        ],
      });
      expect(await drawFrames(screen)).not.toContain("loading…");
      const finished = await screen.redraw();
      expect(finished.lines).toContain("  checks passed 2 of 2");
    });

    it("gives the reason in place of the earlier details when a changed thread's read fails, never drawing loading", async () => {
      let threads = recordedThreads;
      const { promise, reject } = Promise.withResolvers<ThreadDetail>();
      const readDetail = readForever();
      readDetail.mockResolvedValueOnce(parserFixDetail);
      readDetail.mockReturnValueOnce(promise);
      const { screen, refresh } = await showRefreshing(
        readDetail,
        () => threads,
      );
      threads = [
        { ...parserFix, updatedAt: new Date("2026-09-28T11:50+02:00") },
        crash,
        tokensGuide,
      ];
      await refresh();
      reject(providerError("GITHUB_TIMED_OUT"));
      expect(await drawFrames(screen)).not.toContain("loading…");
      const failed = await screen.redraw();
      expect(failed.lines.at(3)).toBe("  ✗ failed: The provider failed with");
    });

    it("keeps a failed read's reason through a refresh, reading again only when the selection comes back", async () => {
      const readDetail = readForever();
      readDetail.mockRejectedValueOnce(providerError("GITHUB_TIMED_OUT"));
      readDetail.mockResolvedValue(parserFixDetail);
      const { screen, refresh } = await showRefreshing(readDetail);
      const refreshed = await refresh();
      expect(refreshed.lines.at(3)).toBe(
        "  ✗ failed: The provider failed with",
      );
      expect(readNumbers(readDetail)).toEqual([12]);
      const back = await press(screen, "j", "j", "k", "k");
      expect(back.lines.at(3)).toBe("  dave · 3d ago");
      expect(readNumbers(readDetail)).toEqual([12, 15, 12]);
    });

    it("lets go of a thread's details once it leaves the data, and reads them again when it comes back", async () => {
      let threads = recordedThreads;
      const readDetail = readForever();
      readDetail.mockResolvedValue(parserFixDetail);
      const { screen, refresh } = await showRefreshing(
        readDetail,
        () => threads,
      );
      threads = [{ ...parserFix, open: false }, crash, tokensGuide];
      const gone = await refresh();
      expect(gone.lines.join("\n")).not.toContain("example#12");
      threads = recordedThreads;
      await refresh();
      const back = await press(screen, "k", "k", "k", "k", "k", "k");
      expect(back.lines.at(1)).toBe(
        `▌┃example#12 reply${" ".repeat(15)}4d over`,
      );
      expect(readNumbers(readDetail).filter((n) => n === 12)).toEqual([12, 12]);
    });

    /**
     * Activity's screen once its selected thread's details are drawn, on
     * a cache whose snapshots give `threads` and whose events are
     * `events`, reading the details once and never after.
     */
    const showActivityRefreshing = async (
      threads?: () => readonly Thread[],
      events?: () => readonly ThreadEvent[],
    ) => {
      const readDetail = readForever();
      readDetail.mockImplementationOnce(readRecordedDetail);
      const shown = await showRefreshing(
        readDetail,
        threads,
        "activity",
        events,
      );
      const drawn = await waitUntil(async () => {
        const { lines } = await shown.screen.redraw();
        expect(lines.at(1)).toBe("  docs#4 issue                       16h");
        expect(lines.join("\n")).not.toContain("loading…");
        return lines;
      });
      return { ...shown, readDetail, drawn };
    };

    it("keeps activity's selected thread's details on screen, read once, when a refresh brings a new copy of the data", async () => {
      const { screen, cache, refresh, readDetail, drawn } =
        await showActivityRefreshing();
      const before = cache.threads();
      await refresh();
      expect(cache.threads()).not.toBe(before);
      expect(await drawFrames(screen)).not.toContain("loading…");
      expect((await screen.redraw()).lines.slice(0, 9)).toEqual(
        drawn.slice(0, 9),
      );
      expect(readNumbers(readDetail)).toEqual([4]);
    });

    it("keeps the details of a thread activity shows and the data does not hold, read once, through refreshes", async () => {
      const { screen, refresh, readDetail, drawn } =
        await showActivityRefreshing(() =>
          recordedThreads.filter(({ number }) => number !== 4),
        );
      await refresh();
      await refresh();
      expect(await drawFrames(screen)).not.toContain("loading…");
      expect((await screen.redraw()).lines.slice(0, 9)).toEqual(
        drawn.slice(0, 9),
      );
      expect(readNumbers(readDetail)).toEqual([4]);
    });

    it("reads again the details of a thread the data does not hold once its row shows a newer event, keeping the earlier ones on screen", async () => {
      let events = recordedEvents;
      const { screen, refresh, readDetail, drawn } =
        await showActivityRefreshing(
          () => recordedThreads.filter(({ number }) => number !== 4),
          () => events,
        );
      events = [
        ...recordedEvents,
        {
          kind: "commented",
          thread: tokensGuide,
          actor: bob,
          at: recordedNow,
        },
      ];
      await refresh();
      await refresh();
      await waitUntil(() => expect(readNumbers(readDetail)).toEqual([4, 4]));
      expect(await drawFrames(screen)).not.toContain("loading…");
      expect((await screen.redraw()).lines.slice(2, 6)).toEqual(
        drawn.slice(2, 6),
      );
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
    async function showActivity(
      width: number,
      cache?: Cache,
      openInBrowser = openNothing,
    ) {
      const opened = cache ?? (await openCache(recordedProvider()));
      await opened.refresh();
      const view = {
        ...viewOf(opened),
        mode: "activity",
        openInBrowser,
      } as const;
      const screen = await draw(
        <WithKeys>
          <Screen {...view} onQuit={() => {}} />
        </WithKeys>,
        width,
        16,
      );
      await waitUntil(async () => {
        const { lines } = await screen.redraw();
        expect(lines.slice(1, 3).join("")).not.toBe("");
        expect(lines).not.toContain("  refresh in progress…");
        expect(lines).not.toContain("  loading…");
      });
      return screen.redraw();
    }

    it("says refresh in progress while the events are read, on opening and after t", async () => {
      const cache = await openCache(recordedProvider());
      await cache.refresh();
      let gate = Promise.withResolvers<void>();
      const view = viewOf(cache);
      const source = {
        ...view.source,
        readEvents: async (repo: string, since: Date) => {
          await gate.promise;
          return cache.readEvents(repo, since, 300_000);
        },
      };
      const screen = await show({ ...view, mode: "activity", source });
      expect((await screen.redraw()).lines.slice(1, 3)).toEqual([
        "",
        "  refresh in progress…",
      ]);
      gate.resolve();
      await waitUntil(async () =>
        expect((await screen.redraw()).lines.at(9)).toBe(
          "2 threads · 3 events",
        ),
      );
      gate = Promise.withResolvers<void>();
      const wider = await press(screen, "t");
      expect(wider.lines.slice(0, 3)).toEqual([
        `activity${" ".repeat(19)}48h · by kind`,
        "",
        "  refresh in progress…",
      ]);
      expect(wider.lines.at(9)).toBe("");
      gate.resolve();
      await waitUntil(async () =>
        expect((await screen.redraw()).lines.at(9)).toBe(
          "2 threads · 4 events",
        ),
      );
    });

    it("lists each thread with its events under it, by kind, and counts them at 40 columns", async () => {
      const screen = await showActivity(40);
      expect(screen.lines).toEqual([
        `activity${" ".repeat(19)}24h · by kind`,
        "ISSUES",
        "  docs#4 issue                       16h",
        "  Where do tokens live?",
        "  alice, bob",
        "  age 27d · owner alice, bob",
        "  last activity 25m ago · dave",
        "  labels none",
        "",
        "",
        "    example-sync labelled kind=docs  16h",
        "PULL REQUESTS",
        "",
        "2 threads · 3 events",
        "synced 0m ago",
        "←→ mode ↑↓ sel ⏎ open g grp t time a r ?",
      ]);
    });

    it("moves the selection over the threads with j and k, never onto a heading", async () => {
      const screen = await showActivity(40);
      const selected = tokens["color.background.selected"];
      expect(screen.look("docs#4")?.bg).toBe(selected);
      const down = await press(screen, "j");
      expect(down.look("Fix the parser")?.bg).toBe(selected);
      expect(down.look("docs#4")?.bg).not.toBe(selected);
      expect(down.look("PULL REQUESTS")?.bg).not.toBe(selected);
      expect((await press(screen, "down")).look("Fix the parser")?.bg).toBe(
        selected,
      );
      const up = await press(screen, "k", "up");
      expect(up.look("docs#4")?.bg).toBe(selected);
      expect(up.look("ISSUES")?.bg).not.toBe(selected);
    });

    it("moves a page of the threads shown, past a heading, never beyond either end, and to either end with home and end", async () => {
      const screen = await showActivity(40);
      const selected = tokens["color.background.selected"];
      // The screen shows docs#4 alone, so a page is one thread.
      expect(screen.lines).not.toContain(" ┃Fix the parser · alice");
      const page = await press(screen, "pagedown");
      expect(page.look("Fix the parser")?.bg).toBe(selected);
      expect(page.look("PULL REQUESTS")?.bg).not.toBe(selected);
      expect((await press(screen, "pagedown")).look("Fix the parser")?.bg).toBe(
        selected,
      );
      const back = await press(screen, "pageup", "pageup");
      expect(back.look("docs#4")?.bg).toBe(selected);
      expect((await press(screen, "end")).look("Fix the parser")?.bg).toBe(
        selected,
      );
      expect((await press(screen, "home")).look("docs#4")?.bg).toBe(selected);
    });

    it("opens the accordion under the selected thread, above its events", async () => {
      const screen = await showActivity(60);
      await press(screen, "j");
      const drawn = await waitUntil(async () => {
        const lines = (await screen.redraw()).lines;
        expect(lines).not.toContain("  loading…");
        return lines;
      });
      const row = drawn.indexOf(" ┃Fix the parser · alice");
      expect(drawn.slice(row + 1, row + 7)).toEqual([
        "  dave · 3d ago",
        "  Rebased on main. Could someone look again?",
        "  waiting since Mon 10:00 · target 24h",
        "  example stack 3 · 2 of 3 · → main",
        "  below #11 merged, above #13 open",
        `    ✗ checks failed (lint)${" ".repeat(31)}25m`,
      ]);
    });

    it("measures only the selected thread and its stack as the screen redraws", async () => {
      const screen = await showActivity(40);
      vi.mocked(findWaits).mockClear();
      await press(screen, "j");
      await screen.redraw();
      const measured = vi
        .mocked(findWaits)
        .mock.calls.map(([thread]) => `${thread.repo}#${thread.number}`);
      expect(measured.length).toBeGreaterThan(0);
      expect(new Set(measured)).toEqual(
        new Set(["example-org/example-repo#12"]),
      );
    });

    it("opens the selected thread's page, as GitHub gives it, with ⏎, and never a heading", async () => {
      const opened: string[] = [];
      const screen = await showActivity(40, undefined, async (url) => {
        opened.push(url);
      });
      await press(screen, "return", "j", "return", "k", "k", "return");
      expect(opened).toEqual([
        "https://github.com/example-org/example-docs/issues/4",
        "https://github.com/example-org/example-repo/pull/12",
        "https://github.com/example-org/example-docs/issues/4",
      ]);
    });

    it("opens the editor under activity's selected thread with a, as in owed, and closes it with esc", async () => {
      const screen = await showActivity(40);
      await press(screen, "a");
      const opened = await waitUntil(async () => {
        const drawn = await screen.redraw();
        expect(drawn.lines).not.toContain("  loading…");
        return drawn;
      });
      expect(opened.lines).toEqual([
        "assigning docs#4",
        "ISSUES",
        "  docs#4 issue                       16h",
        "  Where do tokens live?",
        "  alice, bob",
        "  filter:",
        "  ☑ alice",
        "  ☑ bob",
        "  ☐ carol",
        "  ☐ dave",
        "    example-sync labelled kind=docs  16h",
        "PULL REQUESTS",
        "",
        "2 threads · 3 events",
        "synced 0m ago",
        "type filter ↑↓ ␣ tick ⏎ apply esc ?",
      ]);
      const closed = await press(screen, "escape");
      expect(closed.lines.slice(0, 3)).toEqual([
        `activity${" ".repeat(19)}24h · by kind`,
        "ISSUES",
        "  docs#4 issue                       16h",
      ]);
    });

    it("opens the editor with a on a thread synced after activity opened", async () => {
      const cache = await openCache(recordedProvider());
      const view = { ...viewOf(cache), mode: "activity" } as const;
      const screen = await show(view, 40, () => {}, 16);
      await cache.refresh();
      await waitUntil(async () =>
        expect((await screen.redraw()).lines.at(2)).toBe(
          "  docs#4 issue                       16h",
        ),
      );
      await press(screen, "a");
      const opened = await waitUntil(async () => {
        const drawn = await screen.redraw();
        expect(drawn.lines).toContain("  ☐ carol");
        return drawn;
      });
      expect(opened.lines.at(0)).toBe("assigning docs#4");
    });

    it("refuses a review on activity's selected issue, under its row", async () => {
      const screen = await showActivity(40);
      const refused = await press(screen, "r");
      expect(refused.lines).toEqual([
        `activity${" ".repeat(19)}24h · by kind`,
        "ISSUES",
        "  docs#4 issue                       16h",
        "  Where do tokens live?",
        "  alice, bob",
        "  ✗ docs#4 is not a pull request, so no",
        "  review can be requested on it",
        "  Recovery: select a pull request, then",
        "  press r",
        "    example-sync labelled kind=docs  16h",
        "PULL REQUESTS",
        "",
        "",
        "2 threads · 3 events",
        "✗ review refused",
        "←→ mode ↑↓ sel ⏎ open g grp t time a r ?",
      ]);
    });

    it("refuses both on a thread activity shows that was not open at the last refresh", async () => {
      const cache = await openCache(
        recordedProvider({
          snapshot: async (repo) => ({
            threads: recordedThreads.filter(
              (thread) => thread.repo === repo && thread.number !== 4,
            ),
            cursor: { since: "2026-09-28T09:59:00Z" },
          }),
        }),
      );
      const screen = await showActivity(40, cache);
      const refused = await press(screen, "a");
      expect(refused.lines).toEqual([
        `activity${" ".repeat(19)}24h · by kind`,
        "ISSUES",
        "  docs#4 issue                       16h",
        "  Where do tokens live?",
        "  ✗ docs#4 was not open at the last",
        "  refresh",
        "  Recovery: open it with ⏎ and change it",
        "  on GitHub",
        "    example-sync labelled kind=docs  16h",
        "PULL REQUESTS",
        "",
        "",
        "",
        "2 threads · 3 events",
        "✗ assign refused",
        "←→ mode ↑↓ sel ⏎ open g grp t time a r ?",
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
      await waitUntil(async () =>
        expect((await screen.redraw()).lines.at(13)).toBe(
          "2 threads · 4 events",
        ),
      );
      expect(wider.lines.at(0)).toBe(`activity${" ".repeat(49)}48h`);
      expect((await screen.redraw()).lines).toContain(
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

    it("lists the repositories that read beside one that fails, the status naming the failure", async () => {
      const cache = await openCache(
        recordedProvider({
          events: async (repo) => {
            if (repo === "example-org/example-docs") {
              throw providerError("GITHUB_TIMED_OUT");
            }
            return recordedProvider().events(repo, recordedNow);
          },
        }),
      );
      const screen = await showActivity(40, cache);
      expect(screen.lines.slice(1, 3)).toEqual([
        "PULL REQUESTS",
        " ┃example#12 PR                      25m",
      ]);
      expect(screen.lines.slice(13, 15)).toEqual([
        "1 thread · 2 events",
        "✗ offline · data from 12:00",
      ]);
    });
  });

  describe("keys", () => {
    it("counts every key as attention, and the key still acts; an idle pane says so and which key wakes it", async () => {
      const attention = {
        press: vi.fn(),
        state: () => "idle" as const,
        subscribe: () => () => {},
      };
      const cache = await openCache(recordedProvider());
      await cache.refresh();
      const screen = await drawSuspending(
        <WithKeys>
          <Screen {...viewOf(cache)} attention={attention} onQuit={() => {}} />
        </WithKeys>,
        40,
      );
      expect(screen.lines.at(-2)).toBe("synced 0m ago · idle · any key wakes");
      expect((await press(screen, "left", "?")).lines.at(0)).toBe("help");
      expect(attention.press).toHaveBeenCalledTimes(2);
    });

    it("opens activity at the window and grouping the call names, and t steps on from there", async () => {
      const [, , threeDays] = recordedSettings.activity;
      const view = {
        ...viewOf(await openCache(fakeProvider())),
        mode: "activity",
        activity: { window: threeDays, grouping: "repo" },
      } as const;
      const screen = await (await show(view)).redraw();
      expect(screen.lines.at(0)).toBe(`activity${" ".repeat(19)}72h · by repo`);
      expect((await press(screen, "t")).lines.at(0)).toBe(
        `activity${" ".repeat(20)}1w · by repo`,
      );
    });

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
      expect(owed.lines.at(11)).toBe("←→ mode ↑↓ sel ⏎ open g grp a r ?");
      const activity = await press(screen, "right");
      expect(activity.lines.at(11)).toBe(
        "←→ mode ↑↓ sel ⏎ open g grp t time a r ?",
      );
      expect(activity.look("t")?.bold).toBe(true);
    });

    it("shows every key with ?, grouped, and hides it again", async () => {
      const view = viewOf(await openCache(fakeProvider()));
      const screen = await show(view, 40, () => {}, 36);
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
        "  ⇞ ⇟      a page up or down",
        "  home end the first or last thread",
        "",
        "Thread",
        "  ⏎        open in the browser",
        "  a        assign",
        "  r        request review",
        "",
        "Editor",
        "  type     filter",
        "  ↑ ↓      move",
        "  ␣        toggle",
        "  ⏎        apply",
        "  esc      cancel",
        "",
        "App",
        "  ?        show or hide help",
        "  esc      close help",
        "  R        full refresh",
        "  q        quit",
        "",
        "  windows are counted in working time",
        "",
      ]);
      expect((await press(screen, "?")).lines.at(0)).toBe("owed");
    });

    it("closes the help with esc, in owed and in activity", async () => {
      const screen = await show(viewOf(await openCache(fakeProvider())));
      expect((await press(screen, "?")).lines.at(0)).toBe("help");
      expect((await press(screen, "escape")).lines.at(0)).toBe("owed");
      await press(screen, "right");
      expect((await press(screen, "?")).lines.at(0)).toBe("help");
      expect((await press(screen, "escape")).lines.at(0)).toMatch(/^activity /);
    });

    it("discards the cache and fetches everything again with R", async () => {
      const snapshot = vi.fn(fakeProvider().snapshot);
      const cache = await openCache(fakeProvider({ snapshot }));
      await cache.refresh();
      const screen = await show(viewOf(cache));
      snapshot.mockClear();
      await press(screen, "R");
      await waitUntil(() => expect(snapshot).toHaveBeenCalledTimes(2));
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
      expect(wide.lines.at(11)).toBe("←→ mode ↑↓ sel ⏎ open g grp a r ?");
    });

    // It draws the screen some 90 times, narrowed and widened for each of
    // 21 keys: about 0.7 s alone, and at most 14.7 s over 30 runs at a
    // load average of 88 to 112.
    it("acts on no key but q at 32 columns, and on every key again once widened, the selection where it was", {
      timeout: 45_000,
    }, async () => {
      const cache = await openCache(recordedProvider());
      await cache.refresh();
      const opened: string[] = [];
      const onQuit = vi.fn();
      const view = viewOf(
        cache,
        everyCapability,
        readRecorded,
        readRecordedDetail,
        async (url) => {
          opened.push(url);
        },
      );
      const screen = await show(view, 40, onQuit);
      await press(await screen.redraw(), "j", "j");
      await waitUntil(async () =>
        expect((await screen.redraw()).lines).not.toContain("  loading…"),
      );
      const before = (await screen.redraw()).lines;
      for (const key of [
        ...["left", "h", "right", "l", "up", "k", "down", "j"],
        ...["pageup", "pagedown", "home", "end", "return", "a", "r", "g", "t"],
        ...["R", "?", "escape"],
      ]) {
        screen.setup.resize(32, 12);
        const narrow = await press(await screen.redraw(), key);
        expect(narrow.lines.filter(Boolean)).toEqual([
          "docket needs 40 columns",
        ]);
        screen.setup.resize(40, 12);
        expect((await screen.redraw()).lines).toEqual(before);
      }
      expect(opened).toEqual([]);
      expect(onQuit).not.toHaveBeenCalled();
      screen.setup.resize(32, 12);
      await press(await screen.redraw(), "q");
      expect(onQuit).toHaveBeenCalledOnce();
      screen.setup.resize(40, 12);
      await press(await screen.redraw(), "return");
      expect(opened).toEqual([
        "https://github.com/example-org/example-repo/issues/15",
      ]);
    });
  });
});
