import { describe, expect, it } from "vitest";
import checkText from "./checkText.js";

describe("checkText", () => {
  it("gives back text as it is", () => {
    expect(checkText("announcement", "exempt.close")).toEqual({
      value: "announcement",
      errors: [],
    });
  });

  it("accepts empty text", () => {
    expect(checkText("", "exempt.close").value).toBe("");
  });

  it("refuses a number or a boolean and asks for it to be quoted", () => {
    expect(checkText(true, "exempt.close")).toEqual({
      value: undefined,
      errors: [
        {
          code: "CONFIG_WRONG_TYPE",
          message: "`exempt.close` holds `true`, which is not text.",
          recovery: 'Quote the value, as in `"true"`.',
        },
      ],
    });
    expect(checkText(3, "repos.example.tags").errors[0]?.recovery).toBe(
      'Quote the value, as in `"3"`.',
    );
  });

  it("refuses a list or a map, asking for text instead", () => {
    for (const value of [["core"], new Map([["a", "b"]])]) {
      expect(checkText(value, "exempt.close").errors).toEqual([
        expect.objectContaining({
          code: "CONFIG_WRONG_TYPE",
          recovery: "Write the value as text, not as a list or a map.",
        }),
      ]);
    }
  });
});
