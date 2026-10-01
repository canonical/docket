import { describe, expect, it } from "vitest";
import { fullBudget } from "../../testing/provider.js";
import hasAllReset from "./hasAllReset.js";

const at = fullBudget.resetAt;
const before = new Date(at.getTime() - 1);

describe("hasAllReset", () => {
  it("holds once every report has reset, at its reset or after", () => {
    expect(hasAllReset({ graphql: fullBudget }, at)).toBe(true);
    expect(hasAllReset({ rest: fullBudget }, at)).toBe(true);
    expect(hasAllReset({ graphql: fullBudget }, before)).toBe(false);
  });

  it("holds not while one report is still live", () => {
    const live = { ...fullBudget, resetAt: new Date(at.getTime() + 1) };
    expect(hasAllReset({ graphql: fullBudget, rest: live }, at)).toBe(false);
  });

  it("holds not of no report at all", () => {
    expect(hasAllReset({}, at)).toBe(false);
  });
});
