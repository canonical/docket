import { describe, expect, it } from "vitest";
import parseDuration from "./parseDuration.js";

describe("parseDuration", () => {
  it.each([
    ["24h", { amount: 24, unit: "h" }],
    ["2d", { amount: 2, unit: "d" }],
    ["1w", { amount: 1, unit: "w" }],
    ["120h", { amount: 120, unit: "h" }],
  ])("reads %s", (text, duration) => {
    expect(parseDuration(text)).toEqual(duration);
  });

  it.each([
    "",
    "24",
    "h",
    "0h",
    "05d",
    "1.5d",
    "-1d",
    "2m",
    "1 d",
    " 1d",
    "1D",
  ])("refuses %j", (text) => {
    expect(parseDuration(text)).toBeUndefined();
  });
});
