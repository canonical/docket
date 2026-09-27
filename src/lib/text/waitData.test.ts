import { describe, expect, it } from "vitest";
import { recordedOwed } from "../../testing/recorded.js";
import waitData from "./waitData.js";

const [first, , soon] = recordedOwed().groups[0]?.rows ?? [];
if (!first || !soon) throw new Error("the recording has waits");

describe("waitData", () => {
  it("gives a wait as data, its due time in ISO 8601", () => {
    expect(waitData(soon, "standard")).toEqual({
      reference: "example#15",
      title: "Crash on start",
      kind: "reply",
      state: "soon",
      distance: "4h left",
      owners: [],
      due: "2026-09-28T14:00:00.000Z",
      draft: false,
      checksFailing: false,
      stack: null,
    });
  });

  it("adds when the wait started and its target at the detailed level", () => {
    expect(waitData(first, "detailed")).toMatchObject({
      started: "2026-09-21T08:00:00.000Z",
      target: "24h",
      stack: { number: 3, position: 2, size: 3, base: "main" },
    });
  });
});
