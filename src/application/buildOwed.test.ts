import { describe, expect, it } from "vitest";
import {
  recordedNow,
  recordedOwed,
  recordedSettings,
  recordedThreads,
} from "../testing/recorded.js";
import buildOwed from "./buildOwed.js";

describe("buildOwed", () => {
  it("lists every running wait of the watched repositories, in the grouping asked for", () => {
    for (const grouping of ["none", "owner", "repo", "stack"] as const) {
      expect(
        buildOwed(recordedThreads, recordedSettings, grouping, recordedNow),
      ).toEqual(recordedOwed(grouping));
    }
  });

  it("leaves out threads of repositories no longer watched", () => {
    const watched = {
      ...recordedSettings,
      repos: recordedSettings.repos.slice(1),
    };
    const owed = buildOwed(recordedThreads, watched, "none", recordedNow);
    expect(
      owed.groups.at(0)?.rows.map(({ reference }) => reference.text),
    ).toEqual(["docs#4"]);
  });
});
