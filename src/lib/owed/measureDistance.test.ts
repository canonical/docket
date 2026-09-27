import { describe, expect, it } from "vitest";
import { at, teamSettings, wait } from "../../testing/facts.js";
import measureDistance from "./measureDistance.js";

const { time } = teamSettings;
const now = at("2026-09-23T10:00+02:00");
const day = { amount: 24, unit: "h" } as const;
const twoDays = { amount: 2, unit: "d" } as const;

describe("measureDistance", () => {
  it("reads a wait past its due time in hours over, as a share of its target", () => {
    const over = wait({ due: at("2026-09-22T20:00+02:00") });
    expect(measureDistance(over, time, now)).toEqual({
      state: "over",
      overdue: 14 / 24,
      text: "14h over",
    });
  });

  it("reads a whole working day or more in days, rounded down", () => {
    const over = wait({ due: at("2026-09-21T05:00+02:00") });
    expect(measureDistance(over, time, now).text).toBe("2d over");
  });

  it("leaves the weekend out of the distance past due", () => {
    const monday = at("2026-09-28T10:00+02:00");
    const over = wait({ due: at("2026-09-25T16:00+02:00") });
    expect(measureDistance(over, time, monday).text).toBe("18h over");
  });

  it("marks a wait due soon once less than a fifth of its target is left", () => {
    const soon = wait({ target: twoDays, due: at("2026-09-23T19:00+02:00") });
    expect(measureDistance(soon, time, now)).toEqual({
      state: "soon",
      overdue: -9 / 48,
      text: "9h left",
    });
  });

  it("keeps a wait with exactly a fifth of its target left on track", () => {
    const fifth = wait({
      target: { amount: 5, unit: "d" },
      due: at("2026-09-24T10:00+02:00"),
    });
    expect(measureDistance(fifth, time, now)).toMatchObject({
      state: "onTrack",
      text: "1d left",
    });
  });

  it("reads time left on track in days once a working day or more is left", () => {
    const ahead = wait({ target: twoDays, due: at("2026-09-25T10:00+02:00") });
    expect(measureDistance(ahead, time, now)).toEqual({
      state: "onTrack",
      overdue: -1,
      text: "2d left",
    });
  });

  it("reads a wait due within the hour as no whole hour left", () => {
    const close = wait({ target: day, due: at("2026-09-23T10:40+02:00") });
    expect(measureDistance(close, time, now).text).toBe("0h left");
  });

  it("reads a wait at its due instant as not yet over, and over just after", () => {
    const due = wait({ due: now });
    const later = new Date(now.getTime() + 60_000);
    expect(measureDistance(due, time, now).state).toBe("soon");
    expect(measureDistance(due, time, later).state).toBe("over");
  });
});
