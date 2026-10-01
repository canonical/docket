import { describe, expect, it, vi } from "vitest";
import type { ThreadSummary } from "../lib/waits/index.js";
import { readWeekDetail, weekEndings } from "../testing/endings.js";
import { providerError } from "../testing/provider.js";
import {
  connectRecording,
  ScreenFrame,
  type ScreenFrameProps,
  viewRecording,
} from "../testing/screen.js";
import { drawSuspending, type Screen } from "../testing/terminal.js";
import { waitUntil } from "../testing/wait.js";
import createDetailReader from "./createDetailReader.js";
import type { TerminalView } from "./types.js";

const week = { amount: 1, unit: "w" } as const;

/** finished over the recording's week, opened as `view` names. */
function viewWeek(view: Partial<TerminalView> = {}): ScreenFrameProps {
  return {
    ...viewRecording({ finished: weekEndings, read: readWeekDetail }),
    mode: "finished",
    finished: { window: week, grouping: "kind" },
    ...view,
  };
}

/** Draws the screen on `view`, `height` lines tall, once its window is read. */
async function show(view: ScreenFrameProps, width = 40, height = 24) {
  const screen = await drawSuspending(<ScreenFrame {...view} />, width, height);
  return waitUntil(async () => {
    const drawn = await screen.redraw();
    expect(drawn.lines.at(height - 3)).toMatch(/merged/);
    return drawn;
  });
}

/** Presses `keys` one after another and reads the screen back. */
async function press(screen: Screen, ...keys: string[]) {
  let drawn = screen;
  for (const key of keys) {
    drawn = await drawn.redraw(() => {
      if (key === "left" || key === "right") {
        screen.setup.mockInput.pressArrow(key);
      } else if (key === "return") {
        screen.setup.mockInput.pressEnter();
      } else {
        screen.setup.mockInput.pressKey(key === "end" ? "END" : key);
      }
    });
  }
  return drawn;
}

describe("Screen in finished", { timeout: 15_000 }, () => {
  it("opens at the window and grouping the call names, the newest thread selected with its accordion, counted with its place", async () => {
    const screen = await show(viewWeek());
    expect(screen.lines.slice(0, 8)).toEqual([
      "finished     1w · by kind · newest first",
      `ISSUES ${"─".repeat(33)}`,
      "│ docs#102 issue ○ dave          open 2d",
      "│ Table: sticky header scrolls away",
      "│                                ◉ alice",
      "│ target 30d",
      "│ labels kind=bug",
      "╵   ◉ alice closed as completed       1d",
    ]);
    expect(screen.lines.slice(21)).toEqual([
      "4 merged · 3 closed · 3 over       1/3/7",
      "synced 2m ago",
      "←→ mode ↑↓ sel ⏎ open g grp t time ?",
    ]);
  });

  it("steps its groupings with g: by kind, by ending, by repo, one list, then by kind again", async () => {
    const screen = await show(viewWeek());
    const headers: (string | undefined)[] = [];
    for (let step = 0; step < 4; step += 1) {
      headers.push((await press(screen, "g")).lines.at(0));
    }
    expect(headers).toEqual([
      "finished   1w · by ending · newest first",
      "finished     1w · by repo · newest first",
      "finished    1w · one list · newest first",
      "finished     1w · by kind · newest first",
    ]);
  });

  it("heads by ending's sections with the endings in GitHub's words, the selection kept on its thread", async () => {
    const screen = await press(await show(viewWeek()), "j", "g");
    expect(screen.lines.slice(1, 3)).toEqual([
      `closed as completed ${"─".repeat(20)}`,
      "│ docs#102 issue ○ dave          open 2d",
    ]);
    expect(screen.lines.at(21)).toBe(
      "4 merged · 3 closed · 3 over       1/1/7",
    );
    expect(screen.lines).toContain("┃ Tokens page: contrast       unassigned");
  });

  it("steps its own window with t, apart from activity's", async () => {
    const screen = await show(viewWeek());
    expect((await press(screen, "t")).lines.at(0)).toBe(
      "finished    24h · by kind · newest first",
    );
    const activity = await press(screen, "left", "t");
    expect(activity.lines.at(0)).toBe(
      "activity    48h · by kind · newest first",
    );
    expect((await press(screen, "right")).lines.at(0)).toBe(
      "finished    24h · by kind · newest first",
    );
  });

  it("moves the selection over the threads, its accordion following, never past the last", async () => {
    const screen = await show(
      viewWeek({ finished: { window: week, grouping: "none" } }),
    );
    const moved = await press(screen, "j", "j");
    expect(moved.lines.slice(7, 14)).toEqual([
      "┃┆example#1180 PR ● bob          4d over",
      "┃┆Chip: token migration            ● bob",
      "┃┆open 9d · target 5d",
      "┃┆labels kind=feat",
      "┃┆example stack 11 · 3 of 3 · → main",
      "┃┆below #1179 merged",
      "╹┆  ● bob merged                      2d",
    ]);
    expect(moved.lines.at(21)).toBe("4 merged · 3 closed · 3 over         3/7");
    const last = await press(screen, "end", "j");
    expect(last.lines.at(21)).toBe("4 merged · 3 closed · 3 over         7/7");
  });

  it("reads no details while a thread in no stack is selected, and only stacked pull requests' once one is", async () => {
    // Each read notes whether the selection had reached a stacked pull
    // request, so a read made earlier shows without waiting on a timer.
    let reached = false;
    const asked: [boolean, number[]][] = [];
    const readAhead = vi.fn(async (threads: readonly ThreadSummary[]) => {
      asked.push([reached, threads.map(({ number }) => number)]);
      return Promise.all(threads.map(readWeekDetail));
    });
    const read = vi.fn(async (thread: ThreadSummary) => {
      asked.push([reached, [thread.number]]);
      return readWeekDetail(thread);
    });
    const source = connectRecording({
      finished: weekEndings,
      read,
      details: createDetailReader(readAhead),
    });
    const screen = await show(viewWeek({ source }));
    await press(screen, "j", "j");
    reached = true;
    const stacked = await press(screen, "j");
    expect(stacked.lines).toContain("│┆example#1200 PR ● bob          open 3d");
    const numbers = () => asked.flatMap(([, each]) => each);
    await waitUntil(() => expect(numbers()).toContain(1200));
    expect(asked.every(([after]) => after)).toBe(true);
    expect(numbers().every((each) => [1200, 1180].includes(each))).toBe(true);
  });

  it("keeps a group's heading above its first thread, selected below the top, rather than pinning it", async () => {
    const screen = await show(viewWeek(), 40, 14);
    const up = await press(screen, "end", "k", "k", "k");
    const row = up.lines.indexOf("│┆example#1200 PR ● bob          open 3d");
    expect(row).toBeGreaterThan(1);
    expect(up.lines.at(row - 1)).toBe(`PULL REQUESTS ${"─".repeat(26)}`);
  });

  it("reads a stacked pull request's details, which name its stack's neighbours", async () => {
    const read = vi.fn(readWeekDetail);
    const source = connectRecording({ finished: weekEndings, read });
    const screen = await show(
      viewWeek({ source, finished: { window: week, grouping: "none" } }),
    );
    await waitUntil(async () => {
      expect((await screen.redraw()).lines).toContain(
        "│┆example stack 12 · 1 of 5 · → main",
      );
    });
    expect(read.mock.calls.map(([thread]) => thread.number)).toEqual([1200]);
  });

  it("opens the selected thread's page with ⏎, and opens no editor with a or r", async () => {
    const openInBrowser = vi.fn(async (_url: string) => {});
    const screen = await show(viewWeek({ openInBrowser }));
    const after = await press(screen, "return", "a", "r");
    expect(openInBrowser).toHaveBeenCalledWith(
      "https://github.com/example-org/example-docs/issues/102",
    );
    expect(after.lines.at(0)).toMatch(/^finished/);
    expect(after.lines.at(5)).toBe("│ target 30d");
  });

  it("says nothing merged or closed in the window when nothing did, under the full header", async () => {
    const view = { ...viewWeek(), source: connectRecording() };
    const screen = await drawSuspending(<ScreenFrame {...view} />, 40, 24);
    const drawn = await waitUntil(async () => {
      const lines = (await screen.redraw()).lines;
      expect(lines.at(2)).toBe("  nothing merged or closed in 1w");
      return lines;
    });
    expect(drawn.at(21)).toBe("0 merged · 0 closed · 0 over");
  });

  it("says refresh in progress while its window is read", async () => {
    const source = {
      ...connectRecording(),
      readEvents: () => new Promise<never>(() => {}),
    };
    const screen = await drawSuspending(
      <ScreenFrame {...viewWeek()} source={source} />,
      40,
      24,
    );
    expect((await screen.redraw()).lines.at(2)).toBe("  refresh in progress…");
  });

  it("names on the status line a failure reading its window, with what the cache holds listed", async () => {
    const source = connectRecording({ finished: weekEndings });
    const failing = {
      ...source,
      readEvents: async () => {
        throw providerError("GITHUB_TIMED_OUT");
      },
    };
    const screen = await drawSuspending(
      <ScreenFrame {...viewWeek()} source={failing} />,
      40,
      24,
    );
    const drawn = await waitUntil(async () => {
      const lines = (await screen.redraw()).lines;
      expect(lines.at(2)).toMatch(/^│ docs#102/);
      return lines;
    });
    expect(drawn.at(22)).toMatch(/^✗/);
  });
});
