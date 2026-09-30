import { describe, expect, it } from "vitest";
import { recordedActivity, recordedOwed } from "../testing/recorded.js";
import describePosition from "./describePosition.js";

describe("describePosition", () => {
  it("gives the selected row's place of all when the list has no groups", () => {
    const { groups } = recordedOwed("none");
    expect(describePosition(groups, 0)).toBe("1/6");
    expect(describePosition(groups, 5)).toBe("6/6");
  });

  it("gives the place in its group, the group's size and all when grouped", () => {
    const { groups } = recordedActivity("kind");
    expect(describePosition(groups, 0)).toBe("1/1/2");
    expect(describePosition(groups, 1)).toBe("1/1/2");
  });

  it("counts a wait drawn under each of its two owners once in all", () => {
    const { groups } = recordedOwed("owner");
    const sizes = groups.map(({ rows }) => rows.length);
    expect(sizes).toEqual([3, 2, 2]);
    expect(describePosition(groups, 3)).toBe("1/2/6");
    expect(describePosition(groups, 6)).toBe("2/2/6");
  });

  it("gives nothing when there is no row, or no row at the place", () => {
    expect(describePosition([], 0)).toBeUndefined();
    expect(describePosition(recordedOwed("none").groups, 6)).toBeUndefined();
  });
});
