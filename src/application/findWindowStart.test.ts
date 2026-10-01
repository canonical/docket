import { describe, expect, it } from "vitest";
import { at, teamSettings } from "../testing/facts.js";
import findWindowStart from "./findWindowStart.js";

const now = at("2026-09-28T12:00+02:00");

describe("findWindowStart", () => {
  it("reaches back a calendar week for each working week the window holds, and a day more", () => {
    expect(
      findWindowStart({ amount: 24, unit: "h" }, teamSettings, now),
    ).toEqual(at("2026-09-20T12:00+02:00"));
    expect(
      findWindowStart({ amount: 6, unit: "d" }, teamSettings, now),
    ).toEqual(at("2026-09-13T12:00+02:00"));
  });

  it("counts the working week on the repository's own workdays", () => {
    const fourDays = {
      ...teamSettings,
      time: {
        ...teamSettings.time,
        workdays: ["mon", "tue", "wed", "thu"] as const,
      },
    };
    expect(findWindowStart({ amount: 5, unit: "d" }, fourDays, now)).toEqual(
      at("2026-09-13T12:00+02:00"),
    );
  });
});
