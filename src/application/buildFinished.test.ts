import { describe, expect, it } from "vitest";
import { timeEndings } from "../lib/endings/index.js";
import { at } from "../testing/facts.js";
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
});
