import { describe, expect, it } from "vitest";
import chooseOwedGrouping from "./chooseOwedGrouping.js";

describe("chooseOwedGrouping", () => {
  it("opens owed on the grouping docket owed --by names", () => {
    expect(chooseOwedGrouping({ command: "owed", by: "stack" })).toBe("stack");
  });

  it("opens owed ungrouped for docket owed with no --by", () => {
    expect(chooseOwedGrouping({ command: "owed", by: undefined })).toBe("none");
  });

  it("opens owed ungrouped for activity's --by, which names activity's groupings", () => {
    expect(chooseOwedGrouping({ command: "activity", by: "repo" })).toBe(
      "none",
    );
  });
});
