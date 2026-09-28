import { describe, expect, it } from "vitest";
import { providerError } from "../testing/provider.js";
import isNamedError from "./isNamedError.js";

describe("isNamedError", () => {
  it("accepts an error with a code and a recovery", () => {
    expect(isNamedError(providerError("GH_TIMED_OUT"))).toBe(true);
  });

  it("refuses anything else", () => {
    expect(isNamedError(new Error("plain"))).toBe(false);
    expect(isNamedError(Object.assign(new Error("half"), { code: "X" }))).toBe(
      false,
    );
    expect(isNamedError({ code: "X", recovery: "y" })).toBe(false);
  });
});
