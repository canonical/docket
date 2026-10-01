import { describe, expect, it } from "vitest";
import { at, finishedThread, teamSettings } from "../../testing/facts.js";
import timeEndings from "./timeEndings.js";

describe("timeEndings", () => {
  it("keeps an ending inside a window of working time until the window has passed", () => {
    const thread = finishedThread();
    const [timed] = timeEndings(
      [thread],
      { amount: 24, unit: "h" },
      teamSettings,
    );
    expect(timed?.thread).toBe(thread);
    expect(timed?.until).toEqual(at("2026-09-25T16:00+02:00"));
  });

  it("measures each ending once: its time to close, and how long it was open", () => {
    const [timed] = timeEndings(
      [finishedThread()],
      { amount: 24, unit: "h" },
      teamSettings,
    );
    expect(timed?.measures.close).toMatchObject({
      state: "measured",
      verdict: "within",
    });
    expect(timed?.openTime).toBe(54 * 3_600_000);
  });

  it("counts how long a thread a label exempts was open, with no time to close", () => {
    const [timed] = timeEndings(
      [finishedThread({ labels: ["dependencies"] })],
      { amount: 24, unit: "h" },
      { ...teamSettings, exempt: { close: ["dependencies"] } },
    );
    expect(timed?.measures.close.state).toBe("notApplicable");
    expect(timed?.openTime).toBe(54 * 3_600_000);
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
