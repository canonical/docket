import { describe, expect, it } from "vitest";
import parseStart from "./parseStart.js";

describe("parseStart", () => {
  it.each(["owed", "activity", "finished"] as const)(
    "reads %s as the view docket opens on",
    (view) => {
      expect(parseStart(view)).toEqual({ value: view, errors: [] });
    },
  );

  it("refuses a value that is not a view", () => {
    expect(parseStart("next")).toEqual({
      value: undefined,
      errors: [
        {
          code: "CONFIG_UNKNOWN_VIEW",
          message: '`start` is `"next"`, which is not a view.',
          recovery: "Write one of `owed`, `activity` or `finished`.",
        },
      ],
    });
  });

  it("refuses a value that is not text", () => {
    expect(parseStart(["activity"])).toMatchObject({
      value: undefined,
      errors: [{ code: "CONFIG_WRONG_TYPE" }],
    });
  });
});
