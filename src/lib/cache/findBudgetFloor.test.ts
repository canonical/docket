import { describe, expect, it } from "vitest";
import { fullBudget } from "../../testing/provider.js";
import findBudgetFloor from "./findBudgetFloor.js";

const at = new Date("2026-09-28T10:00:00Z");
const leaving = (remaining: number) => ({ ...fullBudget, remaining });

describe("findBudgetFloor", () => {
  it("holds spending until the reset once less than a fifth of the budget remains", () => {
    expect(findBudgetFloor(leaving(999), at)).toEqual({
      until: fullBudget.resetAt,
      reason: "budget",
    });
  });

  it("lets spending go on at a fifth of the budget or more", () => {
    expect(findBudgetFloor(leaving(1000), at)).toBeUndefined();
  });

  it("lets spending go on once the reset has passed, however little was left", () => {
    expect(findBudgetFloor(leaving(0), fullBudget.resetAt)).toBeUndefined();
  });

  it("lets spending go on while no budget is known", () => {
    expect(findBudgetFloor(undefined, at)).toBeUndefined();
  });
});
