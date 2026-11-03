// Longer than 500 lines because the editor is tested here whole, through the keys of the screen it opens on, on a cache of the recording.
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { useKeymap } from "@opentui/keymap/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { type Cache, createCache } from "../lib/cache/index.js";
import type { Provider } from "../lib/provider/index.js";
import { tokens } from "../lib/tokens/index.js";
import type { Thread } from "../lib/waits/index.js";
import { bob } from "../testing/facts.js";
import { everyCapability, providerError } from "../testing/provider.js";
import {
  parserFixDetail,
  recordedNow,
  recordedOwed,
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
  hex,
  WithKeys,
} from "../testing/terminal.js";
import { waitUntil } from "../testing/wait.js";
import readCandidates from "./readCandidates.js";
import Screen from "./Screen.js";
import type { TerminalView } from "./types.js";
import useEditor, { type UseEditorProps } from "./useEditor.js";
import writeFromTerminal from "./writeFromTerminal.js";

const folders: string[] = [];
afterEach(async () => {
  for (const folder of folders.splice(0)) {
    await rm(folder, { recursive: true, force: true });
  }
});

/** A cache of the recording's repositories on `provider`, filled. */
async function fillCache(provider: Provider) {
  const directory = await mkdtemp(join(tmpdir(), "docket-editor-"));
  folders.push(directory);
  const cache = createCache({
    provider,
    repos: recordedRepos.map(({ repo }) => repo),
    directory,
    now: () => recordedNow,
  });
  await cache.refresh();
  return cache;
}

/** The screen on `cache`, reading and writing through `provider` as the terminal wires it. */
async function showOn(
  cache: Cache,
  provider: Provider,
  width = 40,
  height = 16,
) {
  const view: TerminalView = {
    mode: "owed",
    owedGrouping: "none",
    now: () => recordedNow,
    openInBrowser: async () => {},
    settings: recordedSettings,
    watched: recordedWatched(),
    source: {
      cache,
      capabilities: everyCapability,
      readWatched: async () => ({
        watched: recordedWatched(),
      }),
      readViewer: async () => "alice",
      readDetail: async () => parserFixDetail,
      readCandidates: (action, thread) =>
        readCandidates(provider, action, thread),
      write: (request) => writeFromTerminal({ provider, cache }, request),
      readEvents: (repo, since) => cache.readEvents(repo, since, 300_000),
    },
  };
  const screen = await drawSuspending(
    <WithKeys>
      <Screen {...view} onQuit={() => {}} />
    </WithKeys>,
    width,
    height,
  );
  return screen.redraw();
}

/** The screen on the recording, its data in, on `provider`. */
async function showRecorded(
  provider: Provider = recordedProvider(),
  width = 40,
  height = 16,
) {
  return showOn(await fillCache(provider), provider, width, height);
}

/** Presses `keys` one after another and reads the screen back. */
async function press(screen: Drawn, ...keys: string[]) {
  let drawn = screen;
  for (const key of keys) {
    drawn = await drawn.redraw(() => {
      const input = screen.setup.mockInput;
      if (key === "up" || key === "down") input.pressArrow(key);
      else if (key === "return") input.pressEnter();
      else if (key === "space") input.pressKey(" ");
      else if (key === "escape") input.pressEscape();
      else input.pressKey(key);
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
 * Reads the screen back until `done` holds of it, as GitHub's answers
 * arrive: by default, until nothing says `loading…`.
 */
async function settle(
  screen: Drawn,
  done = (drawn: Drawn) => !drawn.lines.includes("  loading…"),
) {
  let drawn = screen;
  await waitUntil(async () => {
    drawn = await screen.redraw();
    expect(done(drawn)).toBe(true);
  });
  return drawn;
}

/** Whether the status line tells what became of a write. */
const isAnswered = (drawn: Drawn) => drawn.lines.at(-2) !== "synced 0m ago";

/** Whether the screen is back on owed, the editor closed. */
/** owed's header, which an open editor's title takes the place of. */
const owedHeader = `owed${" ".repeat(12)}one list · overdue first`;

const isEditorClosed = (drawn: Drawn) => drawn.lines.at(0) === owedHeader;

/** The lines of the list region: under the header, above the counts. */
const readRegion = (screen: Drawn) => screen.lines.slice(1, -3);

/** A read GitHub refused, whose recovery is a step, then to refresh. */
const unreadable = Object.assign(
  new Error("GitHub refused a request with status 404."),
  {
    code: "GITHUB_REQUEST_FAILED",
    recovery:
      "check that your gh account can read the repository, then refresh",
    step: "check that your gh account can read the repository",
  },
);

/** A provider on the recording that records the assignees it is given. */
function recordAssignees(overrides: Partial<Provider> = {}) {
  let assignees: readonly string[] | undefined;
  const setAssignees = vi.fn(
    async (_thread: unknown, logins: readonly string[]) => {
      assignees = logins;
      return logins.map((login) => ({ login, type: "user" as const }));
    },
  );
  const provider = recordedProvider({
    snapshot: async (repo) => ({
      threads: recordedThreads
        .filter((thread) => thread.repo === repo)
        .map((thread) =>
          assignees && thread.number === 12
            ? {
                ...thread,
                assignees: assignees.map((login) => ({
                  login,
                  type: "user" as const,
                })),
              }
            : thread,
        ),
      cursor: { since: "2026-09-28T09:59:00Z" },
    }),
    setAssignees,
    ...overrides,
  });
  return { provider, setAssignees };
}

// Each test draws the whole screen, with an editor open, on a cache, some
// of them tens of times: at most 0.5 s each at a load average of 50, and
// at most 5.1 s over 30 runs at a load average of 88 to 112, past
// vitest's default of 5 s.
describe("useEditor", { timeout: 15_000 }, () => {
  describe("assigning", () => {
    it("opens under the selected row with a, the assignees ticked first, then the team, the thread's people and everyone assignable", async () => {
      const screen = await settle(await press(await showRecorded(), "a"));
      expect(screen.lines).toEqual([
        "assigning example#12",
        `┃┆example#12 PR reply ○ dave${" ".repeat(5)}4d over`,
        `╹┆Fix the parser${" ".repeat(7)}✗ checks  ◉ alice`,
        "  filter:",
        "  ☑ ◉ alice",
        "  ☐ ● bob",
        "  ☐ ○ dave",
        "  ☐ ◐ carol",
        `┃┆example#12 PR close ○ dave${" ".repeat(5)}2h over`,
        `╹┆Fix the parser${" ".repeat(7)}✗ checks  ◉ alice`,
        "┃ example#15 issue reply ◐ carol 4h left",
        `╹ Crash on start${" ".repeat(14)}unassigned`,
        "  ↓ 3 below",
        `2 over · 1 soon · 3 on track${" ".repeat(9)}1/6`,
        "synced 0m ago",
        "type filter ↑↓ ␣ tick ⏎ apply esc ?",
      ]);
      expect(screen.look("☑ ")?.bg).toBe(
        hex(tokens["color.background.selected"]),
      );
      expect(screen.look("example#12 PR reply")?.bg).toBe(
        hex(tokens["color.background"]),
      );
    });

    it("says loading… until GitHub gives whom it offers", async () => {
      const { promise, resolve } = Promise.withResolvers<void>();
      const provider = recordedProvider({
        assignableUsers: async () => {
          await promise;
          return [];
        },
      });
      const screen = await press(await showRecorded(provider), "a", "down");
      expect(readRegion(screen).slice(2, 4)).toEqual([
        "  filter:",
        "  loading…",
      ]);
      resolve();
      expect(readRegion(await settle(screen)).slice(3, 4)).toEqual([
        "  ☑ ◉ alice",
      ]);
    });

    it("filters the options as letters are typed, however the keys read elsewhere", async () => {
      const screen = await settle(
        await press(await showRecorded(), "a", "q", "g"),
      );
      expect(screen.lines.at(0)).toBe("assigning example#12");
      expect(readRegion(screen).at(2)).toBe("  filter: qg");
      const narrowed = await press(
        await settle(await press(await showRecorded(), "a")),
        "c",
        "a",
      );
      expect(readRegion(narrowed).slice(2, 4)).toEqual([
        "  filter: ca",
        "  ☐ ◐ carol",
      ]);
    });

    it("moves the cursor with the arrows within the options, never past either end", async () => {
      const opened = await settle(await press(await showRecorded(), "a"));
      const moved = await press(opened, "down", "down", "down", "down", "down");
      expect(moved.look("◐ carol")?.bg).toBe(
        hex(tokens["color.background.selected"]),
      );
      const back = await press(moved, "up", "up", "up", "up", "up", "up");
      expect(back.look("☑ ")?.bg).toBe(
        hex(tokens["color.background.selected"]),
      );
    });

    it("ticks and unticks the option under the cursor with ␣", async () => {
      const opened = await settle(await press(await showRecorded(), "a"));
      const ticked = await press(opened, "down", "space", "up", "space");
      expect(readRegion(ticked).slice(3, 5)).toEqual([
        "  ☐ ◉ alice",
        "  ☑ ● bob",
      ]);
      const none = await press(
        await settle(await press(await showRecorded(), "a")),
        "z",
        "space",
      );
      expect(readRegion(none).slice(2, 4)).toEqual([
        "  filter: z",
        `┃┆example#12 PR close ○ dave${" ".repeat(5)}2h over`,
      ]);
    });

    it("sets the whole set with ⏎, closes, says so in the success colour and shows the thread as GitHub has it", async () => {
      const { provider, setAssignees } = recordAssignees();
      const opened = await settle(
        await press(await showRecorded(provider), "a"),
      );
      // carol ticked with the filter narrowed; alice, ticked, stays in the set.
      const typed = await press(opened, "c", "a", "r", "space");
      const applied = await settle(await press(typed, "return"), isAnswered);
      expect(setAssignees).toHaveBeenCalledWith(
        expect.objectContaining({ number: 12 }),
        ["alice", "carol"],
      );
      expect(applied.lines.at(0)).toBe(owedHeader);
      expect(applied.lines.at(2)).toBe(
        `┃┆Fix the parser${" ".repeat(16)}✗ checks`,
      );
      expect(applied.lines.at(-2)).toBe("✓ assigned ◉ alice, ◐ carol");
      expect(applied.look("✓ assigned")?.fg).toBe(
        hex(tokens["color.text.success"]),
      );
      expect(applied.lines.at(3)).toBe(`┃┆${" ".repeat(22)}◉ alice, ◐ carol`);
    });

    it("shows the new set on the row at once, and takes it back when GitHub refuses", async () => {
      const answer = Promise.withResolvers<never>();
      const provider = recordedProvider({ setAssignees: () => answer.promise });
      const opened = await settle(
        await press(await showRecorded(provider, 40, 20), "a"),
      );
      const writing = await press(opened, "down", "space", "return");
      expect(writing.lines.slice(1, 4)).toEqual([
        `┃┆example#12 PR reply ○ dave${" ".repeat(5)}4d over`,
        `┃┆Fix the parser${" ".repeat(16)}✗ checks`,
        `╹┆${" ".repeat(24)}◉ alice, ● bob`,
      ]);
      answer.reject(providerError("GITHUB_REQUEST_FAILED"));
      const refused = await settle(writing, isAnswered);
      expect(refused.lines.at(-2)).toBe("✗ assign refused");
      expect(refused.lines.slice(1, 3)).toEqual([
        `┃┆example#12 PR reply ○ dave${" ".repeat(5)}4d over`,
        `╹┆Fix the parser${" ".repeat(7)}✗ checks  ◉ alice`,
      ]);
    });

    it("unassigns everyone once every box is unticked", async () => {
      const { provider, setAssignees } = recordAssignees();
      const opened = await settle(
        await press(await showRecorded(provider), "a"),
      );
      const applied = await settle(
        await press(opened, "space", "return"),
        isAnswered,
      );
      expect(setAssignees).toHaveBeenCalledWith(expect.anything(), []);
      expect(applied.lines.at(-2)).toBe("✓ unassigned");
    });

    it("sends nothing and closes quietly when the set is unchanged", async () => {
      const { provider, setAssignees } = recordAssignees();
      const opened = await settle(
        await press(await showRecorded(provider), "a"),
      );
      const closed = await settle(
        await press(opened, "return"),
        isEditorClosed,
      );
      expect(setAssignees).not.toHaveBeenCalled();
      expect(closed.lines.at(0)).toBe(owedHeader);
      expect(closed.lines.at(-2)).toBe("synced 0m ago");
    });

    it("sends the set once, however often ⏎ is pressed while it is written", async () => {
      const { promise, resolve } = Promise.withResolvers<void>();
      const { provider, setAssignees } = recordAssignees();
      const slow = recordedProvider({
        ...provider,
        setAssignees: async (thread, logins) => {
          await promise;
          return setAssignees(thread, logins);
        },
      });
      const opened = await settle(await press(await showRecorded(slow), "a"));
      const pressed = await press(opened, "down", "space", "return", "return");
      resolve();
      await settle(pressed, isAnswered);
      expect(setAssignees).toHaveBeenCalledTimes(1);
    });

    it("stays open with GitHub's refusal and its recovery, and says assign refused", async () => {
      const provider = recordedProvider({
        setAssignees: () =>
          Promise.reject(providerError("GITHUB_REQUEST_FAILED")),
      });
      const opened = await settle(
        await press(await showRecorded(provider, 40, 20), "a"),
      );
      const refused = await settle(
        await press(opened, "down", "space", "return"),
        isAnswered,
      );
      expect(refused.lines.at(0)).toBe("assigning example#12");
      expect(readRegion(refused).slice(2, 10)).toEqual([
        "  filter:",
        "  ☑ ◉ alice",
        "  ☑ ● bob",
        "  ☐ ○ dave",
        "  ☐ ◐ carol",
        "  ✗ The provider failed with",
        "  GITHUB_REQUEST_FAILED",
        "  Recovery: try again",
      ]);
      expect(refused.lines.at(-2)).toBe("✗ assign refused");
      expect(refused.look("✗ assign refused")?.fg).toBe(
        hex(tokens["color.text.error"]),
      );
    });

    it("gives GitHub's reason for a change it will not make, and says to apply again", async () => {
      const refused = Object.assign(
        new Error("GitHub refused the request: dave is not a collaborator."),
        {
          code: "GITHUB_REQUEST_FAILED",
          recovery: "change what GitHub's reason names, then refresh",
          step: "change what GitHub's reason names",
        },
      );
      const provider = recordedProvider({
        setAssignees: () => Promise.reject(refused),
      });
      const opened = await settle(
        await press(await showRecorded(provider, 60, 20), "a"),
      );
      const refusal = await settle(
        await press(opened, "down", "down", "space", "return"),
        isAnswered,
      );
      expect(readRegion(refusal).slice(7, 10)).toEqual([
        "  ✗ GitHub refused the request: dave is not a collaborator",
        "  Recovery: change what GitHub's reason names, then apply",
        "  again",
      ]);
      expect(refusal.lines.at(0)).toBe("assigning example#12");
    });

    it("stays open with WRITE_INCOMPLETE's words when GitHub records less than was set", async () => {
      const provider = recordedProvider({
        setAssignees: async () => [],
      });
      const opened = await settle(
        await press(await showRecorded(provider, 60, 20), "a"),
      );
      const short = await settle(
        await press(opened, "down", "down", "down", "space", "return"),
        isAnswered,
      );
      expect(readRegion(short).slice(7, 10)).toEqual([
        "  ✗ GitHub did not record alice, carol on example#12",
        "  Recovery: check that alice, carol can be assigned in",
        "  example-org/example-repo, then apply again",
      ]);
      expect(short.lines.at(-2)).toBe("✗ assign refused");
    });

    it("says why GitHub could not give whom it offers, and applies nothing with ⏎", async () => {
      const { provider, setAssignees } = recordAssignees({
        assignableUsers: () =>
          Promise.reject(providerError("GITHUB_TIMED_OUT")),
      });
      const opened = await settle(
        await press(await showRecorded(provider, 40, 20), "a"),
      );
      expect(readRegion(opened).slice(2, 6)).toEqual([
        "  filter:",
        "  ✗ The provider failed with",
        "  GITHUB_TIMED_OUT",
        "  Recovery: try again",
      ]);
      const pressed = await press(opened, "return", "down", "space", "return");
      // The recording answers a write at once, so one sent has landed here.
      await new Promise((resolve) => setTimeout(resolve, 50));
      const after = await pressed.redraw();
      expect(setAssignees).not.toHaveBeenCalled();
      expect(after.lines.slice(0, 3)).toEqual([
        "assigning example#12",
        `┃┆example#12 PR reply ○ dave${" ".repeat(5)}4d over`,
        `╹┆Fix the parser${" ".repeat(7)}✗ checks  ◉ alice`,
      ]);
      expect(after.lines.at(-2)).toBe("synced 0m ago");
    });

    it("says to close, refresh and open it again with a when GitHub could not give whom it offers", async () => {
      const provider = recordedProvider({
        readAssignees: () => Promise.reject(unreadable),
      });
      const opened = await settle(
        await press(await showRecorded(provider, 60, 20), "a"),
      );
      expect(readRegion(opened).slice(3, 7)).toEqual([
        "  ✗ GitHub refused a request with status 404",
        "  Recovery: check that your gh account can read the",
        "  repository, then close the editor with esc, refresh with",
        "  R, then open it again with a",
      ]);
    });

    it("cancels with esc, sending nothing, and gives the keys back to the list", async () => {
      const { provider, setAssignees } = recordAssignees();
      const opened = await settle(
        await press(await showRecorded(provider), "a"),
      );
      const cancelled = await press(opened, "down", "space", "escape");
      expect(cancelled.lines.at(0)).toBe(owedHeader);
      expect(cancelled.lines.at(-1)).toBe("←→ mode ↑↓ sel ⏎ open g grp a r ?");
      expect(setAssignees).not.toHaveBeenCalled();
      const moved = await press(cancelled, "j");
      expect(moved.look("example#12 PR close")?.bg).toBe(
        hex(tokens["color.background.selected"]),
      );
    });

    it("keeps its state behind the help, which ? still opens, and its keys once the help closes", async () => {
      const opened = await settle(await press(await showRecorded(), "a"));
      const help = await press(opened, "c", "?");
      expect(help.lines.at(0)).toBe("help");
      const back = await press(help, "?");
      expect(readRegion(back).slice(2, 5)).toEqual([
        "  filter: c",
        "  ☑ ◉ alice",
        "  ☐ ◐ carol",
      ]);
      expect(back.lines.at(-1)).toBe("type filter ↑↓ ␣ tick ⏎ apply esc ?");
      const ticked = await press(back, "down", "space");
      expect(readRegion(ticked).slice(2, 5)).toEqual([
        "  filter: c",
        "  ☑ ◉ alice",
        "  ☑ ◐ carol",
      ]);
      const cancelled = await press(ticked, "escape");
      expect(cancelled.lines.at(0)).toBe(owedHeader);
    });

    it("acts on none of its keys while the help covers it, and applies once the help closes", async () => {
      const { provider, setAssignees } = recordAssignees();
      const opened = await settle(
        await press(await showRecorded(provider), "a"),
      );
      const ticked = await press(opened, "down", "space");
      const help = await press(ticked, "?", "return", "space");
      // The recording answers a write at once, so one sent has landed here.
      await new Promise((resolve) => setTimeout(resolve, 50));
      const covered = await help.redraw();
      expect(setAssignees).not.toHaveBeenCalled();
      expect(covered.lines.at(0)).toBe("help");
      const back = await press(covered, "?");
      expect(back.lines.at(0)).toBe("assigning example#12");
      expect(back.lines.at(-2)).toBe("synced 0m ago");
      expect(readRegion(back).slice(3, 5)).toEqual([
        "  ☑ ◉ alice",
        "  ☑ ● bob",
      ]);
      const applied = await settle(await press(back, "return"), isAnswered);
      expect(setAssignees).toHaveBeenCalledWith(expect.anything(), [
        "alice",
        "bob",
      ]);
      expect(applied.lines.at(-2)).toBe("✓ assigned ◉ alice, ● bob");
    });

    it("closes only the help on esc, keeping the editor and its ticks", async () => {
      const { provider, setAssignees } = recordAssignees();
      const opened = await settle(
        await press(await showRecorded(provider), "a"),
      );
      const ticked = await press(opened, "down", "space");
      const back = await press(ticked, "?", "escape");
      expect(back.lines.at(0)).toBe("assigning example#12");
      expect(back.lines.at(-1)).toBe("type filter ↑↓ ␣ tick ⏎ apply esc ?");
      expect(readRegion(back).slice(3, 5)).toEqual([
        "  ☑ ◉ alice",
        "  ☑ ● bob",
      ]);
      expect(setAssignees).not.toHaveBeenCalled();
      const cancelled = await press(back, "escape");
      expect(cancelled.lines.at(0)).toBe(owedHeader);
      expect(setAssignees).not.toHaveBeenCalled();
    });

    it("keeps its keys once a pane too narrow to draw it widens again", async () => {
      const { provider, setAssignees } = recordAssignees();
      const opened = await settle(
        await press(await showRecorded(provider), "a"),
      );
      opened.setup.resize(30, 16);
      const narrow = await opened.redraw();
      expect(narrow.lines.at(0)).toBe("docket needs 40 columns");
      opened.setup.resize(40, 16);
      const wide = await opened.redraw();
      expect(wide.lines.at(-1)).toBe("type filter ↑↓ ␣ tick ⏎ apply esc ?");
      const ticked = await press(wide, "down", "space");
      expect(readRegion(ticked).slice(3, 5)).toEqual([
        "  ☑ ◉ alice",
        "  ☑ ● bob",
      ]);
      const applied = await settle(await press(ticked, "return"), isAnswered);
      expect(setAssignees).toHaveBeenCalledWith(expect.anything(), [
        "alice",
        "bob",
      ]);
      expect(applied.lines.at(-2)).toBe("✓ assigned ◉ alice, ● bob");
    });

    it("ticks, applies and cancels nothing at 32 columns, keeping the editor as it was", async () => {
      const { provider, setAssignees } = recordAssignees();
      const opened = await settle(
        await press(await showRecorded(provider), "a"),
      );
      const before = opened.lines;
      opened.setup.resize(32, 16);
      await press(await opened.redraw(), "down", "space", "return", "escape");
      opened.setup.resize(40, 16);
      expect((await opened.redraw()).lines).toEqual(before);
      expect(setAssignees).not.toHaveBeenCalled();
    });

    it("drops whom GitHub offers once its editor has closed", async () => {
      const { promise, resolve } = Promise.withResolvers<void>();
      const provider = recordedProvider({
        assignableUsers: async () => {
          await promise;
          return [];
        },
      });
      const cancelled = await press(
        await showRecorded(provider),
        "a",
        "escape",
      );
      resolve();
      expect((await settle(cancelled)).lines.at(0)).toBe(owedHeader);
    });

    it("reports a refusal that arrives after its editor closed only on the status line", async () => {
      const { promise, reject } = Promise.withResolvers<never>();
      const provider = recordedProvider({ setAssignees: () => promise });
      const opened = await settle(
        await press(await showRecorded(provider), "a"),
      );
      const closed = await press(opened, "space", "return", "escape");
      reject(providerError("GITHUB_REQUEST_FAILED"));
      const after = await settle(closed, isAnswered);
      expect(after.lines.at(0)).toBe(owedHeader);
      expect(after.lines.at(-2)).toBe("✗ assign refused");
    });

    it("keeps a refusal that arrives after another editor opened out of that editor", async () => {
      const { promise, reject } = Promise.withResolvers<never>();
      const provider = recordedProvider({ setAssignees: () => promise });
      const opened = await settle(
        await press(await showRecorded(provider, 40, 20), "a"),
      );
      const next = await settle(
        await press(opened, "space", "return", "escape", "j", "j", "a"),
      );
      expect(next.lines.at(0)).toBe("assigning example#15");
      reject(providerError("GITHUB_REQUEST_FAILED"));
      const after = await settle(next, isAnswered);
      expect(after.lines.at(0)).toBe("assigning example#15");
      expect(after.lines.join("\n")).not.toContain("GITHUB_REQUEST_FAILED");
      expect(after.lines.at(-2)).toBe("✗ assign refused");
    });

    it("leaves another editor open when a write from a closed one succeeds", async () => {
      const { promise, resolve } = Promise.withResolvers<void>();
      const { provider, setAssignees } = recordAssignees();
      const slow = recordedProvider({
        ...provider,
        setAssignees: async (thread, logins) => {
          await promise;
          return setAssignees(thread, logins);
        },
      });
      const opened = await settle(await press(await showRecorded(slow), "a"));
      const next = await settle(
        await press(opened, "space", "return", "escape", "j", "j", "a"),
      );
      expect(next.lines.at(0)).toBe("assigning example#15");
      resolve();
      const after = await settle(next, isAnswered);
      expect(after.lines.at(-2)).toBe("✓ unassigned");
      expect(after.lines.at(0)).toBe("assigning example#15");
    });

    it("closes once its thread leaves the list", async () => {
      let closed = false;
      const provider = recordedProvider({
        snapshot: async (repo) => ({
          threads: recordedThreads
            .filter((thread) => thread.repo === repo)
            .map((thread) =>
              closed && thread.number === 12
                ? { ...thread, open: false }
                : thread,
            ),
          cursor: { since: "2026-09-28T09:59:00Z" },
        }),
      });
      const cache = await fillCache(provider);
      const opened = await settle(
        await press(await showOn(cache, provider), "a"),
      );
      expect(opened.lines.at(0)).toBe("assigning example#12");
      closed = true;
      await cache.refreshRepo("example-org/example-repo");
      const after = await settle(opened, isEditorClosed);
      expect(after.lines.at(0)).toBe(owedHeader);
      expect(after.lines.at(1)).toBe(
        "┃ example#15 issue reply ◐ carol 4h left",
      );
    });

    it("fits the editor to a wider pane", async () => {
      const screen = await settle(
        await press(await showRecorded(recordedProvider(), 60), "a"),
      );
      expect(screen.lines.at(0)).toBe("assigning example#12");
      expect(screen.lines.slice(3, 5)).toEqual(["  filter:", "  ☑ ◉ alice"]);
      expect(screen.lines.at(-1)).toBe("type filter ↑↓ ␣ tick ⏎ apply esc ?");
    });
  });

  describe("requesting review", () => {
    it("opens with r on a pull request: the requests ticked, then GitHub's suggestions, the collaborators and the teams", async () => {
      const screen = await settle(await press(await showRecorded(), "r"));
      expect(screen.lines.at(0)).toBe("requesting review example#12");
      expect(readRegion(screen).slice(2, 7)).toEqual([
        "  filter:",
        "  ☑ ● bob",
        "  ☐ ◐ carol",
        "  ☐ ◉ alice",
        "  ☐ ◐ example-org/reviewers",
      ]);
    });

    it("requests reviews from people and teams, and says from whom", async () => {
      const setReviewers = vi.fn(recordedProvider().setReviewers);
      const provider = recordedProvider({ setReviewers });
      const opened = await settle(
        await press(await showRecorded(provider), "r"),
      );
      const applied = await settle(
        await press(opened, "down", "down", "down", "space", "return"),
        isAnswered,
      );
      expect(setReviewers).toHaveBeenCalledWith(expect.anything(), [
        { login: bob.login, type: "user" },
        { team: "example-org/reviewers" },
      ]);
      expect(applied.lines.at(-2)).toBe(
        "✓ requested review from ● bob, ◐ review…",
      );
    });

    it("withdraws every request once every box is unticked", async () => {
      const opened = await settle(await press(await showRecorded(), "r"));
      const applied = await settle(
        await press(opened, "space", "return"),
        isAnswered,
      );
      expect(applied.lines.at(-2)).toBe("✓ no review requested");
    });

    it("says to close, refresh and open it again with r when GitHub could not give whom it offers", async () => {
      const provider = recordedProvider({
        reviewCandidates: () => Promise.reject(unreadable),
      });
      const opened = await settle(
        await press(await showRecorded(provider, 60, 20), "r"),
      );
      expect(readRegion(opened).slice(3, 7)).toEqual([
        "  ✗ GitHub refused a request with status 404",
        "  Recovery: check that your gh account can read the",
        "  repository, then close the editor with esc, refresh with",
        "  R, then open it again with r",
      ]);
    });

    it("refuses on an issue, under its row, and says review refused", async () => {
      const screen = await press(
        await showRecorded(recordedProvider(), 40, 20),
        "j",
        "j",
        "r",
      );
      expect(readRegion(screen).slice(4, 9)).toEqual([
        "┃ example#15 issue reply ◐ carol 4h left",
        `╹ Crash on start${" ".repeat(14)}unassigned`,
        "  ✗ example#15 is not a pull request, so",
        "  no review can be requested on it",
        "  Recovery: select a pull request, then",
      ]);
      expect(screen.lines.at(-2)).toBe("✗ review refused");
      const moved = await press(screen, "k");
      expect(moved.lines.join("\n")).not.toContain("not a pull request");
    });
  });

  describe("refusals", () => {
    it("refuses to assign on a discussion", async () => {
      const discussion: Thread = { ...tokensGuide, kind: "discussion" };
      const provider = recordedProvider({
        snapshot: async (repo) => ({
          threads: repo === discussion.repo ? [discussion] : [],
          cursor: null,
        }),
      });
      const screen = await press(await showRecorded(provider), "a");
      expect(readRegion(screen).slice(2, 7)).toEqual([
        `╹${" ".repeat(25)}◉ alice, ● bob`,
        "  ✗ docs#4 is a discussion, and",
        "  discussions have no assignees",
        "  Recovery: select an issue or pull",
        "  request, then press a",
      ]);
      expect(screen.lines.at(-2)).toBe("✗ assign refused");
    });

    it("refuses when nothing is selected, in place of the list", async () => {
      const provider = recordedProvider({
        snapshot: async () => ({ threads: [], cursor: null }),
      });
      const screen = await press(await showRecorded(provider), "a");
      expect(readRegion(screen).slice(0, 4)).toEqual([
        "",
        "  ✗ no issue or pull request is selected",
        "  Recovery: select one with ↑ ↓, then",
        "  press a",
      ]);
    });
  });

  describe("without a source", () => {
    /** The hook alone, its source given by the harness, and its keymap. */
    function Harness({
      start,
      source,
    }: {
      readonly start: (editor: ReturnType<typeof useEditor>) => void;
      readonly source: UseEditorProps["source"];
    }) {
      const editor = useEditor({
        source,
        findTeam: () => [],
        describeCandidate: (name) => ({ text: name, kind: "person" }),
        now: () => recordedNow,
        onResult: () => {},
        covered: false,
      });
      const [started, setStarted] = useState(false);
      if (!started) {
        setStarted(true);
        start(editor);
      }
      return (
        <box>
          <text>{editor.title ?? "closed"}</text>
          {editor.picker && <text>{editor.picker.filter}</text>}
        </box>
      );
    }

    it("opens nothing on a row when there is no source to read", async () => {
      const [row] = recordedOwed().groups.flatMap((group) => group.rows);
      const screen = await draw(
        <WithKeys>
          <Harness
            source={undefined}
            start={(editor) =>
              editor.start("assign", {
                reference: row.reference.text,
                thread: row.wait.thread,
              })
            }
          />
        </WithKeys>,
        40,
        3,
      );
      expect((await screen.redraw()).lines.at(0)).toBe("closed");
    });

    it("runs nothing for the help's filter line, which typing stands for", async () => {
      let keymap: ReturnType<typeof useKeymap> | undefined;
      const Keys = () => {
        keymap = useKeymap();
        return null;
      };
      const screen = await draw(
        <WithKeys>
          <Keys />
          <Harness source={undefined} start={() => {}} />
        </WithKeys>,
        40,
        3,
      );
      await screen.redraw(() => keymap?.runCommand("editor.filter"));
      expect(screen.lines.at(0)).toBe("closed");
    });
  });
});
