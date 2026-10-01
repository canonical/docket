import { describe, expect, it } from "vitest";
import { fullBudget } from "../../testing/provider.js";
import dropFarResets from "./dropFarResets.js";

const at = new Date("2026-09-28T10:00:00Z");
const resetting = (resetAt: string) => ({
  ...fullBudget,
  resetAt: new Date(resetAt),
});

describe("dropFarResets", () => {
  it("keeps each report that resets within the hour and five minutes", () => {
    const budgets = {
      graphql: resetting("2026-09-28T11:05:00Z"),
      rest: resetting("2026-09-28T10:30:00Z"),
    };
    expect(dropFarResets(budgets, at)).toEqual(budgets);
  });

  it("drops each report that resets later, which no answer of GitHub's gives", () => {
    const far = resetting("9999-12-31T00:00:00Z");
    const near = resetting("2026-09-28T10:30:00Z");
    expect(dropFarResets({ graphql: far, rest: near }, at)).toEqual({
      rest: near,
    });
    expect(
      dropFarResets({ rest: resetting("2026-09-28T11:05:01Z") }, at),
    ).toEqual({});
    expect(dropFarResets({}, at)).toEqual({});
  });
});
