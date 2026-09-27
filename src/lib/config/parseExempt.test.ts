import { describe, expect, it } from "vitest";
import parseExempt from "./parseExempt.js";

describe("parseExempt", () => {
  it("reads the labels that switch the close metric off", () => {
    expect(
      parseExempt(new Map([["close", ["announcement", "Topic: roadmap"]]])),
    ).toEqual({
      value: { close: ["announcement", "Topic: roadmap"] },
      errors: [],
    });
  });

  it("reads a section that declares no metric as empty", () => {
    expect(parseExempt(new Map())).toEqual({ value: {}, errors: [] });
  });

  it("refuses a section that is not a map", () => {
    expect(parseExempt(["announcement"])).toEqual({
      value: undefined,
      errors: [expect.objectContaining({ code: "CONFIG_WRONG_TYPE" })],
    });
  });

  it("refuses a metric other than close", () => {
    const checked = parseExempt(new Map([["next-move", ["announcement"]]]));
    expect(checked.value).toEqual({});
    expect(checked.errors).toEqual([
      expect.objectContaining({
        code: "CONFIG_UNKNOWN_KEY",
        message:
          "`exempt` has the key `next-move`, which docket does not know.",
      }),
    ]);
  });

  it("refuses close labels that are not a list", () => {
    expect(parseExempt(new Map([["close", "announcement"]]))).toEqual({
      value: {},
      errors: [
        expect.objectContaining({
          code: "CONFIG_WRONG_TYPE",
          message: "`exempt.close` is not a list.",
        }),
      ],
    });
  });

  it("keeps the labels that are text and refuses the others", () => {
    const checked = parseExempt(new Map([["close", ["announcement", 7]]]));
    expect(checked.value).toEqual({ close: ["announcement"] });
    expect(checked.errors).toEqual([
      expect.objectContaining({
        code: "CONFIG_WRONG_TYPE",
        message: "`exempt.close` holds `7`, which is not text.",
      }),
    ]);
  });
});
