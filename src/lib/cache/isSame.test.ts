import { describe, expect, it } from "vitest";
import isSame from "./isSame.js";

describe("isSame", () => {
  it("holds a value the same as itself, and apart from another", () => {
    expect(isSame(undefined, undefined)).toBe(true);
    expect(isSame(true, false)).toBe(false);
  });

  it("holds dates of the same instant the same", () => {
    expect(isSame(new Date(0), new Date(0))).toBe(true);
    expect(isSame(new Date(0), new Date(1))).toBe(false);
  });

  it("holds object literals the same field by field", () => {
    const until = "2026-09-28T11:00:00Z";
    expect(
      isSame(
        { until: new Date(until), reason: "budget" },
        { until: new Date(until), reason: "budget" },
      ),
    ).toBe(true);
    expect(
      isSame(
        { until: new Date(until), reason: "budget" },
        { until: new Date(until), reason: "rateLimit" },
      ),
    ).toBe(false);
    expect(isSame({ fetched: 1 }, { fetched: 1, total: 2 })).toBe(false);
  });

  it("holds arrays the same entry by entry, in order", () => {
    const waiting = { repo: "example-org/example-repo", stage: "waiting" };
    expect(isSame([{ ...waiting }], [{ ...waiting }])).toBe(true);
    expect(isSame([waiting], [{ ...waiting, stage: "done" }])).toBe(false);
    expect(isSame([waiting], [waiting, waiting])).toBe(false);
    expect(isSame([waiting], { 0: waiting })).toBe(false);
  });

  it("holds an error the same only as itself", () => {
    const error = new Error("no answer");
    expect(isSame(error, error)).toBe(true);
    expect(isSame(error, new Error("no answer"))).toBe(false);
    expect(isSame({ fetched: 1 }, undefined)).toBe(false);
  });
});
