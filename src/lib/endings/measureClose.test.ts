import { describe, expect, it } from "vitest";
import { at, finishedThread, teamSettings } from "../../testing/facts.js";
import measureClose from "./measureClose.js";

const merged = (iso: string) => ({
  outcome: "merged" as const,
  label: "merged",
  at: at(iso),
});

describe("measureClose", () => {
  it("measures from the opening to the merge against the pull request's close target", () => {
    const thread = finishedThread();
    expect(measureClose(thread, teamSettings)).toEqual({
      kind: "close",
      state: "measured",
      started: thread.createdAt,
      ended: thread.ending.at,
      target: { amount: 5, unit: "d" },
      overdue: (54 - 120) / 120,
      verdict: "within",
    });
  });

  it("gives the verdict over once the working time passes the target", () => {
    const late = finishedThread({
      ending: merged("2026-09-30T16:00+02:00"),
    });
    const measure = measureClose(late, teamSettings);
    expect(measure).toMatchObject({ verdict: "over", overdue: 30 / 120 });
  });

  it("gives within when the thread closes exactly at its target", () => {
    const onTime = finishedThread({
      ending: merged("2026-09-29T10:00+02:00"),
    });
    expect(measureClose(onTime, teamSettings)).toMatchObject({
      verdict: "within",
      overdue: 0,
    });
  });

  it("leaves the weekend out of the time open", () => {
    const acrossWeekend = finishedThread({
      createdAt: at("2026-09-25T16:00+02:00"),
      ending: merged("2026-09-28T10:00+02:00"),
    });
    expect(measureClose(acrossWeekend, teamSettings)).toMatchObject({
      overdue: (18 - 120) / 120,
    });
  });

  it("uses the close target of the thread's kind", () => {
    const issue = finishedThread({ kind: "issue" });
    expect(measureClose(issue, teamSettings)).toMatchObject({
      target: { amount: 30, unit: "d" },
    });
  });

  it("does not apply to a thread a label exempts, whatever its case", () => {
    const settings = { ...teamSettings, exempt: { close: ["Dependencies"] } };
    const exempt = finishedThread({ labels: ["dependencies"] });
    expect(measureClose(exempt, settings)).toEqual({
      kind: "close",
      state: "notApplicable",
    });
  });
});
