import { describe, expect, it } from "vitest";

/**
 * This entry fails, and its row says so with `expect = "fail"`. The
 * invoker calls a tier green only once it has seen this entry fail as a
 * test, so a green tier cannot come from a runner that reports success
 * whatever happens, or from a selector that matched nothing.
 *
 * Do not repair it: a passing run of this file turns the tier red.
 */
describe("corpus-can-fail", () => {
  it("fails on purpose, so that a green tier means something", () => {
    expect("the corpus does not report failure").toBe(
      "the corpus reports failure",
    );
  });
});
