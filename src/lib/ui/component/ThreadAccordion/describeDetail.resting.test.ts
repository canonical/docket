import { describe, expect, it } from "vitest";
import {
  overReviewDetail,
  sharedCloseDetail,
} from "../../../../testing/details.js";
import {
  alice,
  at,
  dave,
  exampleSync,
  teamSettings,
} from "../../../../testing/facts.js";
import { recordedNow } from "../../../../testing/recorded.js";
import { overReview, sharedClose } from "../../../../testing/rows.js";
import { tokens } from "../../../tokens/index.js";
import describeDetail from "./describeDetail.js";
import readTexts from "./readTexts.js";
import type { DetailLine } from "./types.js";

const reading = {
  now: recordedNow,
  timezone: "Europe/Paris",
  waiting: { "example#13": "close" },
};

/** The colour of the run of `line` that reads `text`. */
const colourOf = (line: DetailLine | undefined, text: string) =>
  line?.pieces.find((piece) => piece.text === text)?.fg;

describe("describeDetail, for a thread no wait runs on", () => {
  const people = teamSettings.people;

  it("says loading, dimmed, until its details arrive, since the snapshot holds nothing of it", () => {
    const resting = {
      repo: "example",
      thread: overReview.wait.thread,
      people,
    };
    const { body, stack } = describeDetail(resting, undefined, reading);
    expect(readTexts(body)).toEqual(["loading…"]);
    expect(body.at(0)?.pieces.at(0)?.fg).toBe(tokens["color.text.muted"]);
    expect(stack).toEqual([]);
  });

  it("gives the close body from its details, with the owners its row names and whoever wrote last behind their marks", () => {
    const resting = {
      repo: "example",
      thread: sharedClose.wait.thread,
      owners: [
        { text: "alice", kind: "person" as const, group: "you" as const },
        { text: "bob", kind: "person" as const, group: "team" as const },
      ],
      people,
      viewer: "alice",
    };
    const { body } = describeDetail(resting, sharedCloseDetail, reading);
    expect(readTexts(body)).toEqual([
      "age 6d · owner ◉ alice, ● bob",
      "last activity 3h ago · ● bob",
      "labels priority=high · kind=bug · area/icons",
    ]);
    expect(colourOf(body[1], "● bob")).toBe(tokens["color.text.team"]);
  });

  it("gives a closed thread its age, its assignees that are not bots as owners behind their marks, its labels and no opener, then its stack lines; an open one nobody wrote on its opener", () => {
    const resting = {
      repo: "example",
      thread: overReview.wait.thread,
      people,
      viewer: "alice",
    };
    const closed = {
      ...sharedCloseDetail,
      assignees: [alice, dave, exampleSync],
    };
    expect(readTexts(describeDetail(resting, closed, reading).body)).toEqual([
      "age 6d · owner ◉ alice, ○ dave",
      "last activity 3h ago · ● bob",
      "labels priority=high · kind=bug · area/icons",
    ]);
    const unassigned = {
      ...sharedCloseDetail,
      assignees: [exampleSync],
      messages: [],
    };
    expect(
      readTexts(describeDetail(resting, unassigned, reading).body),
    ).toEqual([
      "age 6d · owner unassigned",
      "last activity 3h ago",
      "labels priority=high · kind=bug · area/icons",
    ]);
    // The same thread open, which nobody has written on: its opener,
    // at its opening.
    const open = {
      ...resting,
      author: {
        text: "dave",
        kind: "person" as const,
        group: "outside" as const,
      },
    };
    expect(readTexts(describeDetail(open, unassigned, reading).body)).toEqual([
      "age 6d · owner unassigned",
      "last activity 6d ago · ○ dave",
      "labels priority=high · kind=bug · area/icons",
    ]);
    expect(
      readTexts(describeDetail(resting, overReviewDetail, reading).stack),
    ).toEqual([
      "example stack 3 · 2 of 3 · → main",
      "below #11 merged, above #13 close",
    ]);
  });

  it("marks a bot that wrote last as a bot", () => {
    const resting = {
      repo: "example",
      thread: overReview.wait.thread,
      people,
    };
    const botted = {
      ...sharedCloseDetail,
      messages: [
        { author: exampleSync, at: at("2026-09-28T09:00+02:00"), body: "" },
      ],
    };
    expect(readTexts(describeDetail(resting, botted, reading).body).at(1)).toBe(
      `last activity 3h ago · ■ ${exampleSync.login}`,
    );
  });
});
