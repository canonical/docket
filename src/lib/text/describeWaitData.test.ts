import { describe, expect, it } from "vitest";
import { recordedOwed } from "../../testing/recorded.js";
import describeWaitData from "./describeWaitData.js";

const [first, , soon] = recordedOwed().groups.at(0)?.rows ?? [];
if (!first || !soon) throw new Error("the recording has waits");

describe("describeWaitData", () => {
  it("gives a wait as data, its kind as an identifier and its due time in ISO 8601", () => {
    expect(describeWaitData(soon, "standard")).toEqual({
      reference: "example#15",
      title: "Crash on start",
      kind: "response",
      state: "soon",
      overdue: -1 / 6,
      owners: [],
      due: "2026-09-28T14:00:00.000Z",
      draft: false,
      checksFailing: false,
      stack: null,
      target: "24h",
    });
  });

  it("gives the target at every level, so overdue times target is the working time past due", () => {
    const standard = describeWaitData(first, "standard");
    expect(standard).toMatchObject({ overdue: 49 / 12, target: "24h" });
    expect(standard.overdue * 24).toBe(98);
  });

  it("adds when the wait started at the detailed level", () => {
    expect(describeWaitData(first, "detailed")).toMatchObject({
      started: "2026-09-21T08:00:00.000Z",
      target: "24h",
      stack: { number: 3, position: 2, size: 3, base: "main" },
    });
  });
});
