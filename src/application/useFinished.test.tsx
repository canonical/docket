import { describe, expect, it } from "vitest";
import { readWeekDetail, weekEndings } from "../testing/endings.js";
import {
  recordedNow,
  recordedThreads,
  recordedWatched,
} from "../testing/recorded.js";
import { connectRecording } from "../testing/screen.js";
import { draw } from "../testing/terminal.js";
import useFinished, { type UseFinishedProps } from "./useFinished.js";

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

/** Draws the list's headings and summary on one line, or `reading`. */
function Probe(probed: UseFinishedProps) {
  const result = useFinished(probed);
  if (!result || !("list" in result)) return <text>reading</text>;
  const { groups, summary } = result.list;
  const headings = groups.map(({ heading }) => heading?.text).join(", ");
  return <text>{`${headings} · ${summary.text}`}</text>;
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
});
