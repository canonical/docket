import { describe, expect, it } from "vitest";
import { findActivityRow } from "../testing/activity.js";
import { overReview, soonReply } from "../testing/rows.js";
import findThreadState from "./findThreadState.js";

describe("findThreadState", () => {
  it("gives the thread's first running wait, which tells its current state", () => {
    const row = findActivityRow(12);
    expect(findThreadState(row, [soonReply, overReview])).toBe(overReview);
  });

  it("rests a thread no wait runs on, with the owners its row names", () => {
    const row = findActivityRow(15);
    expect(findThreadState(row, [overReview])).toEqual({
      repo: "example",
      thread: row.thread,
      owners: "alice, bob",
    });
    const unowned = findActivityRow(14);
    expect(findThreadState(unowned, []).owners).toBe("unassigned");
  });

  it("rests a thread whose row names no owner with no owners", () => {
    const { owner: _, ...row } = findActivityRow(12);
    expect(findThreadState(row, [])).toEqual({
      repo: "example",
      thread: row.thread,
    });
  });
});
