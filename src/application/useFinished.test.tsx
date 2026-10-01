import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { measureWorkingTime } from "../lib/clock/index.js";
import { readWeekDetail, weekEndings } from "../testing/endings.js";
import {
  recordedNow,
  recordedThreads,
  recordedWatched,
} from "../testing/recorded.js";
import { connectRecording } from "../testing/screen.js";
import { draw } from "../testing/terminal.js";
import useFinished, { type UseFinishedProps } from "./useFinished.js";

// The working clock is watched, not replaced, to count how often a list
// built at each instant counts working time.
vi.mock("../lib/clock/index.js", async (importOriginal) => {
  const clock = await importOriginal<typeof import("../lib/clock/index.js")>();
  return { ...clock, measureWorkingTime: vi.fn(clock.measureWorkingTime) };
});

const week = { amount: 1, unit: "w" } as const;

const props: UseFinishedProps = {
  source: connectRecording({ finished: weekEndings, read: readWeekDetail }),
  threads: recordedThreads,
  syncedAt: recordedNow,
  shown: true,
  watched: recordedWatched(),
  window: week,
  grouping: "ending",
  now: () => recordedNow,
  at: recordedNow,
  viewer: "alice",
};

let moveTo: (at: Date) => void = () => {};

/** Draws the list's headings and summary on one line, or `reading`. */
function Probe(probed: UseFinishedProps) {
  const [at, setAt] = useState(probed.at);
  moveTo = setAt;
  const result = useFinished({ ...probed, at });
  if (!result || !("list" in result)) return <text>reading</text>;
  const { groups, summary } = result.list;
  const headings = groups.map(({ heading }) => heading?.text).join(", ");
  const counts = summary.fields.map(({ text }) => text).join(" · ");
  return <text>{`${headings} · ${counts}`}</text>;
}

describe("useFinished", () => {
  it("lists the threads that finished in its window, read through the cache, in the grouping given", async () => {
    const screen = await draw(<Probe {...props} />, 120, 1);
    const read = await screen.redraw();
    expect(read.lines.at(0)).toBe(
      "closed as completed, closed as not planned, merged · 4 merged · 3 closed · 3 over",
    );
  });

  it("lists only the threads that ended within a shorter window", async () => {
    const day = { amount: 24, unit: "h" } as const;
    const screen = await draw(<Probe {...props} window={day} />, 120, 1);
    expect((await screen.redraw()).lines.at(0)).toBe(
      "closed as completed, closed as not planned, merged · 2 merged · 2 closed · 2 over",
    );
  });

  it("measures each thread's time open once for each read, however often the list is built again", async () => {
    const screen = await draw(<Probe {...props} />, 120, 1);
    await screen.redraw();
    const measured = vi.mocked(measureWorkingTime).mock.calls.length;
    expect(measured).toBeGreaterThan(0);
    for (const minutes of [1, 2, 3]) {
      const later = new Date(recordedNow.getTime() + minutes * 60_000);
      await screen.redraw(() => moveTo(later));
    }
    expect(vi.mocked(measureWorkingTime).mock.calls).toHaveLength(measured);
  });
});
