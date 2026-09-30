import { describe, expect, it } from "vitest";
import {
  duplicatesAndQuiet,
  finishedNow,
  notPlanned,
  repoEndings,
} from "../../testing/finished.js";
import countEndings from "./countEndings.js";
import listEndings from "./listEndings.js";

const rows = listEndings(repoEndings(), finishedNow).rows;

describe("countEndings", () => {
  it("counts merged apart from every other outcome, and the threads past their target among those measured", () => {
    expect(countEndings(rows)).toEqual({
      merged: 1,
      closed: 3,
      over: { value: 1, of: 3, pending: 0 },
      byKind: {
        issue: { completed: 1, notPlanned: 1, duplicate: 0, closed: 0 },
        pullRequest: { merged: 1, closed: 1 },
      },
    });
  });

  it("counts nothing over an empty list", () => {
    expect(countEndings([])).toMatchObject({
      merged: 0,
      closed: 0,
      over: { value: 0, of: 0, pending: 0 },
    });
  });

  it("counts each outcome of an issue apart: duplicates, and closes with no reason recorded", () => {
    const counted = countEndings(
      listEndings(repoEndings([notPlanned, ...duplicatesAndQuiet]), finishedNow)
        .rows,
    );
    expect(counted.byKind.issue).toEqual({
      completed: 0,
      notPlanned: 1,
      duplicate: 2,
      closed: 1,
    });
    expect([counted.merged, counted.closed]).toEqual([0, 4]);
  });
});
