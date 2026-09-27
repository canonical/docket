import { describe, expect, it } from "vitest";
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

  it("leaves out threads of repositories no longer watched", () => {
    const watched = recordedWatched().slice(1);
    const owed = buildOwed(recordedThreads, watched, "none", recordedNow);
    expect(
      owed.groups.at(0)?.rows.map(({ reference }) => reference.text),
    ).toEqual(["docs#4"]);
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
