import { describe, expect, it } from "vitest";
import { findActivityRow } from "../testing/activity.js";
import { thread } from "../testing/facts.js";
import { overReview, soonReply } from "../testing/rows.js";
import findThreadState from "./findThreadState.js";

describe("findThreadState", () => {
  it("gives the thread's first running wait, which tells its current state", () => {
    const row = findActivityRow(12);
    expect(findThreadState(row, [soonReply, overReview], [])).toBe(overReview);
  });

  it("rests a thread no wait runs on, with its facts and the owners its row names", () => {
    const row = findActivityRow(15);
    const facts = thread({ number: 15, title: "Crash on start" });
    expect(findThreadState(row, [overReview], [facts])).toEqual({
      repo: "example",
      thread: facts,
      owners: "alice, bob",
    });
    const unowned = findActivityRow(14);
    expect(findThreadState(unowned, [], []).owners).toBe("unassigned");
  });

  it("rests a thread whose facts are not held with no owners", () => {
    const { owner: _, ...row } = findActivityRow(12);
    const { repo, number, url, kind, title, stack } = row.thread;
    expect(findThreadState(row, [], [])).toEqual({
      repo: "example",
      thread: { repo, number, url, kind, title, stack },
    });
  });
});
