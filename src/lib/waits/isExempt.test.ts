import { describe, expect, it } from "vitest";
import isExempt from "./isExempt.js";

describe("isExempt", () => {
  const exempt = { close: ["Topic: roadmap"] };

  it("exempts a thread carrying a listed label, whatever its case", () => {
    expect(isExempt(["bug", "topic: Roadmap"], exempt)).toBe(true);
  });

  it("leaves a thread with no listed label on the close clock", () => {
    expect(isExempt(["bug"], exempt)).toBe(false);
    expect(isExempt([], exempt)).toBe(false);
  });

  it("exempts nothing when the settings list no label", () => {
    expect(isExempt(["topic: roadmap"], { close: [] })).toBe(false);
  });
});
