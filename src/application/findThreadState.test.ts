import { describe, expect, it } from "vitest";
import { findActivityRow } from "../testing/activity.js";
import { teamSettings } from "../testing/facts.js";
import { overReview, soonReply } from "../testing/rows.js";
import findThreadState from "./findThreadState.js";

const { people } = teamSettings;

describe("findThreadState", () => {
  it("gives the thread's first running wait, which tells its current state", () => {
    const row = findActivityRow(12);
    expect(findThreadState(row, [soonReply, overReview], people)).toBe(
      overReview,
    );
  });

  it("rests a thread no wait runs on, with the owners its row names, the repository's people and the viewer", () => {
    const row = findActivityRow(15);
    expect(findThreadState(row, [overReview], people, "alice")).toEqual({
      repo: "example",
      thread: row.thread,
      owners: row.owners?.fields,
      people,
      viewer: "alice",
    });
    const unowned = findActivityRow(14);
    expect(findThreadState(unowned, [], people)).toMatchObject({
      owners: [{ text: "unassigned" }],
    });
  });

  it("rests a thread whose row names no owner with no owners", () => {
    const { owner: _, ...row } = findActivityRow(12);
    expect(findThreadState(row, [], people)).toEqual({
      repo: "example",
      thread: row.thread,
      people,
    });
  });
});
