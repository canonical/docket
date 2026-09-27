import { describe, expect, it } from "vitest";
import formatValue from "./formatValue.js";

describe("formatValue", () => {
  it("writes text in double quotes", () => {
    expect(formatValue("mon")).toBe('"mon"');
  });

  it("writes numbers, booleans and nothing as they read", () => {
    expect(formatValue(3)).toBe("3");
    expect(formatValue(false)).toBe("false");
    expect(formatValue(null)).toBe("null");
    expect(formatValue(undefined)).toBe("undefined");
  });

  it("writes a list in brackets", () => {
    expect(formatValue(["mon", 2])).toBe('["mon", 2]');
    expect(formatValue([])).toBe("[]");
  });

  it("writes a map in braces", () => {
    expect(formatValue(new Map([["alice", "team"]]))).toBe(
      '{ "alice": "team" }',
    );
    expect(formatValue(new Map())).toBe("{}");
  });

  it("shows a list or map inside another as brackets or braces only", () => {
    expect(formatValue([["a"], new Map([["b", 1]])])).toBe("[[…], {…}]");
    expect(formatValue(new Map([["days", ["mon"]]]))).toBe('{ "days": […] }');
  });

  it("shows the first five entries of a longer list or map", () => {
    expect(formatValue([1, 2, 3, 4, 5])).toBe("[1, 2, 3, 4, 5]");
    expect(formatValue([1, 2, 3, 4, 5, 6])).toBe("[1, 2, 3, 4, 5, …]");
    const map = new Map([1, 2, 3, 4, 5, 6].map((key) => [key, key]));
    expect(formatValue(map)).toBe("{ 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, … }");
  });
});
