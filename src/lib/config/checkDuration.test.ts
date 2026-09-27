import { describe, expect, it } from "vitest";
import checkDuration from "./checkDuration.js";

describe("checkDuration", () => {
  it("reads a duration in hours, working days or working weeks", () => {
    expect(checkDuration("24h", "targets.close.issue")).toEqual({
      value: { amount: 24, unit: "h" },
      errors: [],
    });
    expect(checkDuration("2d", "targets.close.issue").value).toEqual({
      amount: 2,
      unit: "d",
    });
    expect(checkDuration("1w", "targets.close.issue").value).toEqual({
      amount: 1,
      unit: "w",
    });
  });

  it("accepts the longest duration in each unit", () => {
    for (const text of ["43800h", "1825d", "260w"]) {
      expect(checkDuration(text, "activity").errors).toEqual([]);
    }
  });

  it("refuses text that is not a duration, naming where it sits", () => {
    expect(checkDuration("soon", "targets.close.issue")).toEqual({
      value: undefined,
      errors: [
        {
          code: "CONFIG_INVALID_DURATION",
          message:
            '`targets.close.issue` is `"soon"`, which is not a duration.',
          recovery:
            "Write a whole number followed by h, d or w, such as `24h`, `2d` or `1w`.",
        },
      ],
    });
  });

  it("refuses a value that is not text", () => {
    expect(checkDuration(24, "activity").errors).toEqual([
      expect.objectContaining({
        code: "CONFIG_INVALID_DURATION",
        message: "`activity` is `24`, which is not a duration.",
      }),
    ]);
  });

  it("refuses a duration longer than about five years, naming each limit", () => {
    expect(checkDuration("261w", "activity")).toEqual({
      value: undefined,
      errors: [
        {
          code: "CONFIG_INVALID_DURATION",
          message:
            '`activity` is `"261w"`, which is longer than docket accepts.',
          recovery:
            "Write a duration no longer than `43800h`, `1825d` or `260w`.",
        },
      ],
    });
  });
});
