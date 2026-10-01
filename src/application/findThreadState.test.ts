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

  it("rests a thread no wait runs on, with the owners its row names, its opener, the repository's people and the viewer", () => {
    const row = findActivityRow(15);
    expect(findThreadState(row, [overReview], people, "alice")).toEqual({
      repo: "example",
      thread: row.thread,
      owners: row.owners?.fields,
      author: row.author,
      people,
      viewer: "alice",
    });
    const unowned = findActivityRow(14);
    expect(findThreadState(unowned, [], people)).toMatchObject({
      owners: [{ text: "unassigned" }],
    });
  });

  it("rests a thread in a repository whose own file is invalid with that mark", () => {
    const row = findActivityRow(4);
    expect(findThreadState(row, [], people)).toMatchObject({
      invalidFile: { text: "invalid repository file" },
    });
  });

  it("rests a thread whose row names no owner with no owners, and a closed one, which has no facts, with no opener", () => {
    const { owner: _, author: __, ...row } = findActivityRow(12);
    expect(findThreadState(row, [], people)).toEqual({
      repo: "example",
      thread: row.thread,
      people,
    });
  });
});
