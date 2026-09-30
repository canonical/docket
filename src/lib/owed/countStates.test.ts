import { describe, expect, it } from "vitest";
import { at, teamSettings, wait } from "../../testing/facts.js";
import buildRow from "./buildRow.js";
import countStates from "./countStates.js";

const now = at("2026-09-23T10:00+02:00");
const row = (due: string) =>
  buildRow(
    wait({ due: at(due) }),
    "example",
    teamSettings.time,
    now,
    teamSettings.people,
    [],
  );

describe("countStates", () => {
  it("counts the waits over target, due soon and on track", () => {
    const rows = [
      row("2026-09-22T20:00+02:00"),
      row("2026-09-22T21:00+02:00"),
      row("2026-09-23T12:00+02:00"),
      row("2026-09-23T23:00+02:00"),
    ];
    expect(countStates(rows)).toEqual({ over: 2, soon: 1, onTrack: 1 });
  });

  it("counts nothing in an empty list", () => {
    expect(countStates([])).toEqual({ over: 0, soon: 0, onTrack: 0 });
  });
});
