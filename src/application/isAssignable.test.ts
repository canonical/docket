import { describe, expect, it } from "vitest";
import { crash, parserFix, tokensGuide } from "../testing/recorded.js";
import isAssignable from "./isAssignable.js";

describe("isAssignable", () => {
  it("takes issues and pull requests", () => {
    expect(isAssignable(crash)).toBe(true);
    expect(isAssignable(parserFix)).toBe(true);
  });

  it("refuses a discussion, which has no assignees", () => {
    expect(isAssignable({ ...tokensGuide, kind: "discussion" })).toBe(false);
  });
});
