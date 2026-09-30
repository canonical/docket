import { describe, expect, it } from "vitest";
import { timeEndings } from "../lib/endings/index.js";
import { at, finishedThread } from "../testing/facts.js";
import {
  recordedFinished,
  recordedNow,
  recordedThreads,
  recordedWatched,
} from "../testing/recorded.js";
import buildFinished from "./buildFinished.js";

const window = { amount: 24, unit: "h" } as const;

/** The recording's finished threads, by repository, timed against the window. */
const timed = new Map(
  recordedWatched().map(({ repo, resolved }) => [
    repo,
    timeEndings(
      recordedFinished.filter((thread) => thread.repo === repo),
      window,
      resolved.settings,
    ),
  ]),
);

const references = (list: ReturnType<typeof buildFinished>) =>
  list.groups.flatMap(({ rows }) =>
    rows.map(({ reference }) => reference.text),
  );

describe("buildFinished", () => {
  it("lists the threads that finished within the window at the instant given, grouped as asked", () => {
    const list = buildFinished(
      timed,
      recordedThreads,
      recordedWatched(),
      window,
      "ending",
      recordedNow,
      "alice",
    );
    expect(list.address).toEqual({
      mode: "finished",
      window,
      grouping: "ending",
    });
    expect(list.groups.map(({ heading }) => heading?.text)).toEqual([
      "closed as completed",
      "merged",
    ]);
    expect(list.groups[1]?.rows[0]?.ending.actor?.group).toBe("you");
    // Tuesday morning, Sunday's merge has left the 24-hour window.
    const later = buildFinished(
      timed,
      recordedThreads,
      recordedWatched(),
      window,
      "none",
      at("2026-09-29T09:00+02:00"),
    );
    expect(references(later)).toEqual(["docs#3"]);
  });

  it("marks the rows of a repository whose own file is invalid, and lists none for a repository given nothing", () => {
    const [example, docs] = recordedWatched();
    const invalid = recordedWatched(undefined, [
      { code: "CONFIG_INVALID_DURATION", message: "", recovery: "" },
    ]);
    const list = buildFinished(
      new Map([...timed].filter(([repo]) => repo === docs?.repo)),
      recordedThreads,
      [example, invalid[1]].filter((repo) => repo !== undefined),
      window,
      "none",
      recordedNow,
    );
    expect(
      list.groups.flatMap(({ rows }) =>
        rows.map(({ reference, invalidFile }) => [
          reference.text,
          invalidFile?.text,
        ]),
      ),
    ).toEqual([["docs#3", "invalid repository file"]]);
  });

  it("keeps a thread whose ending leaves the window at the very instant given", () => {
    const [thread] = recordedFinished;
    if (!thread) throw new Error("the recording holds a finished thread");
    const list = buildFinished(
      new Map([[thread.repo, [{ thread, until: recordedNow }]]]),
      recordedThreads,
      recordedWatched(),
      window,
      "none",
      recordedNow,
    );
    expect(references(list)).toEqual(["example#14"]);
  });

  it("gives a member who wrote only a finished thread one group wherever the row names them", () => {
    const repo = "example-org/example-repo";
    const erin = { login: "erin", type: "user" } as const;
    const wrote = finishedThread({
      number: 1,
      kind: "issue",
      author: { ...erin, member: true },
      ending: {
        outcome: "completed",
        label: "closed as completed",
        at: at("2026-09-29T10:00Z"),
        by: erin,
      },
    });
    const merged = finishedThread({
      number: 2,
      assignees: [erin],
      ending: {
        outcome: "merged",
        label: "merged",
        at: at("2026-09-29T11:00Z"),
        by: erin,
      },
    });
    const until = at("2026-10-05T00:00Z");
    const list = buildFinished(
      new Map([[repo, [wrote, merged].map((thread) => ({ thread, until }))]]),
      [],
      recordedWatched(),
      { amount: 1, unit: "w" },
      "none",
      at("2026-09-30T10:00Z"),
    );
    const rows = list.groups.flatMap(({ rows }) => rows);
    expect(
      rows.map(({ reference, author, ending, owner }) => [
        reference.text,
        author.group,
        ending.actor?.group,
        owner && "group" in owner ? owner.group : undefined,
      ]),
    ).toEqual([
      ["example#2", "team", "internal", "internal"],
      ["example#1", "internal", "internal", undefined],
    ]);
  });
});
