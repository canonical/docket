import { describe, expect, it } from "vitest";
import { fullBudget } from "../../testing/provider.js";
import mergeBudgets from "./mergeBudgets.js";

const makeBudget = (remaining: number, resetAt = fullBudget.resetAt) => ({
  ...fullBudget,
  remaining,
  resetAt,
});
const nextHour = new Date("2026-09-28T12:00:00Z");

describe("mergeBudgets", () => {
  it("keeps, within one window, the report with less left", () => {
    expect(
      mergeBudgets(
        { graphql: makeBudget(4000) },
        { graphql: makeBudget(3000) },
      ),
    ).toEqual({ graphql: makeBudget(3000) });
    expect(
      mergeBudgets(
        { graphql: makeBudget(3000) },
        { graphql: makeBudget(4000) },
      ),
    ).toEqual({ graphql: makeBudget(3000) });
  });

  it("keeps the report of the later window, however much it has left", () => {
    const fresh = makeBudget(4999, nextHour);
    expect(
      mergeBudgets({ graphql: fresh }, { graphql: makeBudget(10) }),
    ).toEqual({
      graphql: fresh,
    });
    expect(
      mergeBudgets({ graphql: makeBudget(10) }, { graphql: fresh }),
    ).toEqual({
      graphql: fresh,
    });
  });

  it("keeps each kind apart, and whichever report a kind has alone", () => {
    expect(
      mergeBudgets({ rest: makeBudget(100) }, { graphql: makeBudget(200) }),
    ).toEqual({ rest: makeBudget(100), graphql: makeBudget(200) });
    expect(mergeBudgets({}, {})).toEqual({});
  });
});
