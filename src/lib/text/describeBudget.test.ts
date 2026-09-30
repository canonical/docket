import { describe, expect, it } from "vitest";
import describeBudget from "./describeBudget.js";

const now = new Date("2026-09-28T11:00:00Z");
const resetAt = new Date("2026-09-28T12:20:00Z");
const leave = (remaining: number) => ({ limit: 5000, remaining, resetAt });

describe("describeBudget", () => {
  it("says the share left and when it resets, in the time zone, below 40% of the budget", () => {
    expect(describeBudget(leave(1750), now, "Europe/Paris")).toBe(
      "budget 35% · resets 14:20",
    );
    expect(describeBudget(leave(1999), now, "UTC")).toBe(
      "budget 39% · resets 12:20",
    );
    expect(describeBudget(leave(0), now, "UTC")).toBe(
      "budget 0% · resets 12:20",
    );
  });

  it("says nothing at 40% or more, once the budget has reset, or with none known", () => {
    expect(describeBudget(leave(2000), now, "UTC")).toBe("");
    expect(describeBudget(leave(100), resetAt, "UTC")).toBe("");
    expect(describeBudget(undefined, now, "UTC")).toBe("");
  });
});
