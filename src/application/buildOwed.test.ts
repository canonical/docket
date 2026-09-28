import { describe, expect, it } from "vitest";
import { thread } from "../testing/facts.js";
import {
  recordedNow,
  recordedOwed,
  recordedSettings,
  recordedThreads,
  recordedWatched,
} from "../testing/recorded.js";
import buildOwed from "./buildOwed.js";

describe("buildOwed", () => {
  it("lists every running wait of the watched repositories, in the grouping asked for", () => {
    for (const grouping of ["none", "owner", "repo", "stack"] as const) {
      expect(
        buildOwed(recordedThreads, recordedWatched(), grouping, recordedNow),
      ).toEqual(recordedOwed(grouping));
    }
  });

  it("marks the viewer among the people each row names", () => {
    const owed = buildOwed(
      recordedThreads,
      recordedWatched(),
      "none",
      recordedNow,
      "alice",
    );
    const rows = owed.groups.flatMap(({ rows }) => rows);
    const assignedToAlice = rows.find(
      ({ owner }) => owner?.text === "alice",
    )?.owner;
    expect(assignedToAlice).toMatchObject({ group: "team", viewer: true });
    expect(
      rows.every(({ author }) => author.viewer === (author.text === "alice")),
    ).toBe(true);
  });

  it("leaves out threads of repositories no longer watched", () => {
    const watched = recordedWatched().slice(1);
    const owed = buildOwed(recordedThreads, watched, "none", recordedNow);
    expect(
      owed.groups.at(0)?.rows.map(({ reference }) => reference.text),
    ).toEqual(["docs#4"]);
  });

  it("measures each repository's waits on that repository's own clock", () => {
    const watched = [
      ...recordedWatched().slice(0, 1),
      ...recordedWatched({
        ...recordedSettings,
        time: {
          ...recordedSettings.time,
          workdays: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"],
        },
      }).slice(1),
    ];
    const threads = [
      thread({ repo: "example-org/example-repo", number: 1 }),
      thread({ repo: "example-org/example-docs", number: 1 }),
    ];
    const owed = buildOwed(threads, watched, "none", recordedNow);
    // Opened Tuesday 10:00, measured Monday 12:00: 98 working hours on
    // five workdays, 146 on seven.
    expect(
      owed.groups
        .flatMap(({ rows }) => rows)
        .map(({ reference, kind, distance }) =>
          [reference.text, kind.text, distance.text].join(" "),
        ),
    ).toEqual([
      "docs#1 reply 5d over",
      "example#1 reply 3d over",
      "docs#1 close 23d left",
      "example#1 close 25d left",
    ]);
  });

  it("marks the rows of a repository whose own file is invalid", () => {
    const invalid = recordedWatched(recordedSettings, [
      {
        code: "CONFIG_UNKNOWN_KEY",
        message: "The file has an unknown key.",
        recovery: "Remove it.",
      },
    ]);
    const owed = buildOwed(recordedThreads, invalid, "none", recordedNow);
    expect(
      owed.groups.at(0)?.rows.every(({ invalidFile }) => invalidFile),
    ).toBe(true);
  });
});
