import { describe, expect, it } from "vitest";
import estimateRemaining from "./estimateRemaining.js";

const startedAt = new Date("2026-09-28T12:00:00Z");
const clockAfter = (seconds: number) =>
  new Date(startedAt.getTime() + seconds * 1_000);

describe("estimateRemaining", () => {
  it("says nothing before a second, a page, or any work left", () => {
    expect(
      estimateRemaining({ fetched: 1, total: 3 }, startedAt, clockAfter(0.5)),
    ).toBeUndefined();
    expect(
      estimateRemaining({ fetched: 0, total: 3 }, startedAt, clockAfter(2)),
    ).toBeUndefined();
    expect(
      estimateRemaining({ fetched: 3, total: 3 }, startedAt, clockAfter(2)),
    ).toBeUndefined();
  });

  it("estimates the seconds left from the pages read so far", () => {
    expect(
      estimateRemaining({ fetched: 1, total: 3 }, startedAt, clockAfter(2)),
    ).toBe("~4s left");
  });

  it("names whole minutes once the estimate is over a minute", () => {
    expect(
      estimateRemaining({ fetched: 1, total: 31 }, startedAt, clockAfter(60)),
    ).toBe("~30m left");
  });
});
