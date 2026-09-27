import { describe, expect, it } from "vitest";
import checkList from "./checkList.js";

describe("checkList", () => {
  it("gives back a list as it is", () => {
    const list = ["mon", 2];
    const checked = checkList(list, "time.workdays");
    expect(checked).toEqual({ value: list, errors: [] });
    expect(checked.value).toBe(list);
  });

  it("accepts an empty list", () => {
    expect(checkList([], "hosts")).toEqual({ value: [], errors: [] });
  });

  it("refuses a value that is not a list, naming where it sits", () => {
    expect(checkList("mon", "time.workdays")).toEqual({
      value: undefined,
      errors: [
        {
          code: "CONFIG_WRONG_TYPE",
          message: "`time.workdays` is not a list.",
          recovery:
            "Write `time.workdays` as a list, such as `[first, second]`.",
        },
      ],
    });
  });

  it("refuses a map", () => {
    expect(checkList(new Map(), "hosts").value).toBeUndefined();
  });
});
