import { describe, expect, it } from "vitest";
import parseTime from "./parseTime.js";

describe("parseTime", () => {
  it("reads the workdays and the time zone", () => {
    expect(
      parseTime(
        new Map<string, unknown>([
          ["workdays", ["mon", "tue", "wed"]],
          ["timezone", "Europe/Paris"],
        ]),
      ),
    ).toEqual({
      value: { workdays: ["mon", "tue", "wed"], timezone: "Europe/Paris" },
      errors: [],
    });
  });

  it("keeps only the keys a section declares", () => {
    expect(parseTime(new Map([["timezone", "UTC"]]))).toEqual({
      value: { timezone: "UTC" },
      errors: [],
    });
    expect(parseTime(new Map())).toEqual({ value: {}, errors: [] });
  });

  it("refuses a section that is not a map", () => {
    expect(parseTime(["mon"])).toEqual({
      value: undefined,
      errors: [expect.objectContaining({ code: "CONFIG_WRONG_TYPE" })],
    });
  });

  it("refuses a key it does not know", () => {
    expect(parseTime(new Map([["holidays", []]])).errors).toEqual([
      expect.objectContaining({
        code: "CONFIG_UNKNOWN_KEY",
        recovery: "Remove `holidays`, or use one of `workdays`, `timezone`.",
      }),
    ]);
  });

  describe("workdays", () => {
    it("refuses workdays that are not a list", () => {
      const checked = parseTime(new Map([["workdays", "mon"]]));
      expect(checked.value).toEqual({});
      expect(checked.errors).toEqual([
        expect.objectContaining({
          code: "CONFIG_WRONG_TYPE",
          message: "`time.workdays` is not a list.",
        }),
      ]);
    });

    it("refuses an empty list, on which the clock would never run", () => {
      expect(parseTime(new Map([["workdays", []]])).errors).toEqual([
        {
          code: "CONFIG_EMPTY_LIST",
          message:
            "`time.workdays` lists no day, so the clock would never run.",
          recovery:
            "List at least one day, such as `[mon, tue, wed, thu, fri]`.",
        },
      ]);
    });

    it("refuses a day it does not know", () => {
      expect(parseTime(new Map([["workdays", ["monday"]]])).errors).toEqual([
        {
          code: "CONFIG_UNKNOWN_WORKDAY",
          message: '`time.workdays` lists `"monday"`, which is not a day.',
          recovery:
            "Write days as `mon`, `tue`, `wed`, `thu`, `fri`, `sat`, `sun`.",
        },
      ]);
    });

    it("refuses a day listed twice", () => {
      expect(
        parseTime(new Map([["workdays", ["mon", "tue", "mon"]]])).errors,
      ).toEqual([
        {
          code: "CONFIG_DUPLICATE_WORKDAY",
          message: "`time.workdays` lists `mon` twice.",
          recovery: "Keep one `mon` in `time.workdays`.",
        },
      ]);
    });
  });

  describe("timezone", () => {
    it("refuses a name outside the IANA time-zone database", () => {
      const checked = parseTime(new Map([["timezone", "Mars/Olympus"]]));
      expect(checked).toEqual({
        value: {},
        errors: [
          {
            code: "CONFIG_UNKNOWN_TIMEZONE",
            message:
              '`time.timezone` is `"Mars/Olympus"`, which is not a time-zone name.',
            recovery:
              "Write a name from the IANA time-zone database, such as `Europe/Paris` or `UTC`.",
          },
        ],
      });
    });

    it("refuses a time zone that is not text", () => {
      expect(parseTime(new Map([["timezone", 2]])).errors).toEqual([
        expect.objectContaining({
          code: "CONFIG_UNKNOWN_TIMEZONE",
          message: "`time.timezone` is `2`, which is not a time-zone name.",
        }),
      ]);
    });
  });
});
