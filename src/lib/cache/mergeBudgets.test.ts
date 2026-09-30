import { describe, expect, it } from "vitest";
import { fullBudget } from "../../testing/provider.js";
import mergeBudgets from "./mergeBudgets.js";

const leaving = (remaining: number, resetAt = fullBudget.resetAt) => ({
  ...fullBudget,
  remaining,
  resetAt,
});
const nextHour = new Date("2026-09-28T12:00:00Z");

describe("mergeBudgets", () => {
  it("keeps, within one window, the report with less left", () => {
    expect(
      mergeBudgets({ graphql: leaving(4000) }, { graphql: leaving(3000) }),
    ).toEqual({ graphql: leaving(3000) });
    expect(
      mergeBudgets({ graphql: leaving(3000) }, { graphql: leaving(4000) }),
    ).toEqual({ graphql: leaving(3000) });
  });

  it("keeps the report of the later window, however much it has left", () => {
    const fresh = leaving(4999, nextHour);
    expect(mergeBudgets({ graphql: fresh }, { graphql: leaving(10) })).toEqual({
      graphql: fresh,
    });
    expect(mergeBudgets({ graphql: leaving(10) }, { graphql: fresh })).toEqual({
      graphql: fresh,
    });
  });

  it("keeps each kind apart, and whichever report a kind has alone", () => {
    expect(
      mergeBudgets({ rest: leaving(100) }, { graphql: leaving(200) }),
    ).toEqual({ rest: leaving(100), graphql: leaving(200) });
    expect(mergeBudgets({}, {})).toEqual({});
  });
});
