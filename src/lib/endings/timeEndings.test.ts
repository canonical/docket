import { describe, expect, it } from "vitest";
import { at, finishedThread, teamSettings } from "../../testing/facts.js";
import timeEndings from "./timeEndings.js";

describe("timeEndings", () => {
  it("keeps an ending inside a window of working time until the window has passed", () => {
    const thread = finishedThread();
    expect(
      timeEndings([thread], { amount: 24, unit: "h" }, teamSettings),
    ).toEqual([{ thread, until: at("2026-09-25T16:00+02:00") }]);
  });

  it("carries a window across the weekend, as events are timed", () => {
    const friday = finishedThread({
      ending: {
        outcome: "completed",
        label: "closed as completed",
        at: at("2026-09-25T16:00+02:00"),
      },
    });
    const [timed] = timeEndings(
      [friday],
      { amount: 24, unit: "h" },
      teamSettings,
    );
    expect(timed?.until).toEqual(at("2026-09-28T16:00+02:00"));
  });
});
