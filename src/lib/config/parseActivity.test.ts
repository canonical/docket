import { describe, expect, it } from "vitest";
import parseActivity from "./parseActivity.js";

describe("parseActivity", () => {
  it("reads the time windows in the order written", () => {
    expect(parseActivity(["48h", "1w"])).toEqual({
      value: [
        { amount: 48, unit: "h" },
        { amount: 1, unit: "w" },
      ],
      errors: [],
    });
  });

  it("refuses a section that is not a list", () => {
    expect(parseActivity("24h")).toEqual({
      value: undefined,
      errors: [expect.objectContaining({ code: "CONFIG_WRONG_TYPE" })],
    });
  });

  it("refuses an empty list", () => {
    expect(parseActivity([])).toEqual({
      value: [],
      errors: [
        {
          code: "CONFIG_EMPTY_LIST",
          message: "`activity` lists no time window.",
          recovery: "List at least one window, such as `[24h, 48h, 72h, 1w]`.",
        },
      ],
    });
  });

  it("keeps the windows it reads and refuses each one it cannot", () => {
    const checked = parseActivity(["24h", "soon", "9999w"]);
    expect(checked.value).toEqual([{ amount: 24, unit: "h" }]);
    expect(checked.errors.map((error) => error.code)).toEqual([
      "CONFIG_INVALID_DURATION",
      "CONFIG_INVALID_DURATION",
    ]);
  });
});
