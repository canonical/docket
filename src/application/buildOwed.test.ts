import { describe, expect, it } from "vitest";
import { carol, thread } from "../testing/facts.js";
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

  it("names the viewer you among the people each row names", () => {
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
    expect(assignedToAlice).toMatchObject({ group: "you" });
    expect(
      rows.every(
        ({ author }) => (author.group === "you") === (author.text === "alice"),
      ),
    ).toBe(true);
  });

  it("gives a login one group as author and as owner on the same row", () => {
    const opened = thread({
      author: carol,
      assignees: [{ login: "carol", type: "user" }],
    });
    const owed = buildOwed([opened], recordedWatched(), "none", recordedNow);
    const rows = owed.groups.flatMap(({ rows }) => rows);
    expect(rows.map(({ kind }) => kind.text)).toEqual(["reply", "close"]);
    for (const { author, owner } of rows) {
      expect([author, owner]).toEqual([
        { text: "carol", fit: "trimmed", group: "internal" },
        { text: "carol", fit: "trimmed", group: "internal" },
      ]);
    }
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

  it("names a team the personal file lists as yours you, on its row and its owner's heading", () => {
    const asked = thread({
      kind: "pullRequest",
      repo: "example-org/example-repo",
      reviewRequests: [
        {
          reviewer: { team: "example-org/ui", members: [] },
          at: new Date("2026-09-28T09:00+02:00"),
        },
      ],
    });
    const yours = recordedWatched({
      ...recordedSettings,
      you: { teams: ["example-org/ui"] },
    });
    const byOwner = (watched: typeof yours) =>
      buildOwed([asked], watched, "owner", recordedNow, "alice").groups.find(
        ({ heading }) => heading?.text === "example-org/ui",
      );
    const mine = byOwner(yours);
    expect(mine?.heading).toMatchObject({ group: "you" });
    expect(mine?.rows.at(0)?.owner).toMatchObject({ group: "you" });
    const unlisted = byOwner(recordedWatched());
    expect(unlisted?.heading).not.toHaveProperty("group");
    expect(unlisted?.rows.at(0)?.owner).not.toHaveProperty("group");
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
