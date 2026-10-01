import { describe, expect, it } from "vitest";
import { findActivityRow } from "../testing/activity.js";
import { findFinishedRow } from "../testing/finished.js";
import { parserFix } from "../testing/recorded.js";
import describeRowVersion from "./describeRowVersion.js";

describe("describeRowVersion", () => {
  it("gives a thread the data holds its last change and its checks", () => {
    const row = findFinishedRow("example#7");
    expect(describeRowVersion(row, parserFix)).toBe(
      `${parserFix.updatedAt.getTime()}|failing`,
    );
  });

  it("gives a finished thread the data does not hold its ending", () => {
    const row = findFinishedRow("example#7");
    expect(describeRowVersion(row, undefined)).toBe(
      `${row.thread.ending.at.getTime()}`,
    );
  });

  it("gives an activity thread the data does not hold its newest event", () => {
    const row = findActivityRow(12);
    expect(describeRowVersion(row, undefined)).toBe(
      `${row.events.at(0)?.event.at.getTime()}`,
    );
  });
});
