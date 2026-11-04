import { describe, expect, it } from "vitest";
import { groupWaits, listWaits } from "../lib/owed/index.js";
import {
  recordedNow,
  recordedThreads,
  recordedWatched,
} from "../testing/recorded.js";
import buildOwed from "./buildOwed.js";
import prepareOwed from "./prepareOwed.js";

describe("prepareOwed", () => {
  it("can measure and group the same snapshot at different times", () => {
    const watched = recordedWatched();
    const prepared = prepareOwed(recordedThreads, watched);
    for (const now of [
      recordedNow,
      new Date(recordedNow.getTime() + 3_600_000),
    ]) {
      const actual = groupWaits(
        listWaits(prepared, now, "alice"),
        { mode: "owed", grouping: "owner" },
        watched,
      );
      expect(actual).toEqual(
        buildOwed(recordedThreads, watched, "owner", now, "alice"),
      );
    }
  });
});
