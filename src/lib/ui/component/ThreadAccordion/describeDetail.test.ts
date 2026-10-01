import { describe, expect, it } from "vitest";
import { readTexts } from "../../../../testing/accordion.js";
import {
  overReviewDetail,
  sharedCloseDetail,
} from "../../../../testing/details.js";
import {
  alice,
  at,
  bob,
  carol,
  dave,
  exampleSync,
  teamSettings,
  thread,
} from "../../../../testing/facts.js";
import { recordedNow } from "../../../../testing/recorded.js";
import {
  draftClose,
  measureRow,
  overReview,
  sharedClose,
  soonReply,
} from "../../../../testing/rows.js";
import type { WaitRow } from "../../../owed/index.js";
import type { ThreadDetail } from "../../../provider/index.js";

import { tokens } from "../../../tokens/index.js";

import describeDetail from "./describeDetail.js";
import type { DetailLine } from "./types.js";

const reading = {
  now: recordedNow,
  timezone: "Europe/Paris",
  waiting: { "example#13": "close" },
};

/** The colour of the run of `line` that reads `text`. */
const colourOf = (line: DetailLine | undefined, text: string) =>
  line?.pieces.find((piece) => piece.text === text)?.fg;

describe("describeDetail", () => {
  describe("a reply", () => {
    it("gives who wrote the message awaiting it and when, the message whole, then when the reply began, from the snapshot alone", () => {
      const { body, stack } = describeDetail(soonReply, undefined, reading);
      expect(readTexts(body)).toEqual([
        "○ dave · 1d ago",
        "It crashes as soon as it starts, before the first frame is drawn.",
        "waiting since Tue 10:00 · target 24h",
      ]);
      expect(
        body.map(({ kind, most, optional }) => [kind, most, optional]),
      ).toEqual([
        ["words", undefined, undefined],
        ["quote", undefined, undefined],
        ["words", undefined, true],
      ]);
      expect(stack).toEqual([]);
    });

    it("marks the author in their hue and dims docket's own words, leaving the message plain", () => {
      const [author, message, since] = describeDetail(
        soonReply,
        undefined,
        reading,
      ).body;
      expect(colourOf(author, "○ dave")).toBe(tokens["color.text.outside"]);
      expect(colourOf(author, " · 1d ago")).toBe(tokens["color.text.muted"]);
      expect(message?.pieces.at(0)?.fg).toBe(tokens["color.text"]);
      expect(since?.pieces.at(0)?.fg).toBe(tokens["color.text.muted"]);
    });

    it("shows the same lines once the details arrive, since the snapshot holds them all", () => {
      expect(describeDetail(soonReply, overReviewDetail, reading)).toEqual(
        describeDetail(soonReply, undefined, reading),
      );
    });

    it("shows the author's newest message, a comment or a review, whichever came last", () => {
      const talked = thread({
        comments: [
          {
            author: soonReply.wait.author,
            at: at("2026-09-27T12:00+02:00"),
            text: "Newer.",
          },
        ],
        reviews: [
          {
            author: soonReply.wait.author,
            at: at("2026-09-26T12:00+02:00"),
            text: "Older.",
          },
        ],
      });
      const row = measureRow({ ...soonReply.wait, thread: talked });
      expect(
        readTexts(describeDetail(row, undefined, reading).body).at(1),
      ).toBe("Newer.");
    });

    it("names the author and when the thread opened when the snapshot holds no message of theirs nor the opening's text", () => {
      const quiet = measureRow({ ...soonReply.wait, thread: thread() });
      expect(readTexts(describeDetail(quiet, undefined, reading).body)).toEqual(
        ["○ dave · 6d ago", "waiting since Tue 10:00 · target 24h"],
      );
    });

    it("gives the opening's text as the message while its author has written nothing since", () => {
      const opened = measureRow({
        ...soonReply.wait,
        thread: thread({ text: "It crashes." }),
      });
      expect(
        readTexts(describeDetail(opened, undefined, reading).body),
      ).toEqual([
        "○ dave · 6d ago",
        "It crashes.",
        "waiting since Tue 10:00 · target 24h",
      ]);
    });
  });

  describe("a review", () => {
    it("gives who asked and when and the pushes since at once, the changes and the checks ending in … until the details arrive", () => {
      const { body } = describeDetail(overReview, undefined, reading);
      expect(readTexts(body)).toEqual([
        "asked by ● alice 3d ago",
        "1 push since · …",
        "✗ checks: …",
      ]);
      expect(colourOf(body[0], "asked by ")).toBe(tokens["color.text.muted"]);
      expect(colourOf(body[0], "● alice")).toBe(tokens["color.text.team"]);
      expect(colourOf(body[2], "✗ checks:")).toBe(tokens["color.text.error"]);
    });

    it("fills in the files and lines and which checks failed once the details arrive, on the same lines", () => {
      const { body } = describeDetail(overReview, overReviewDetail, reading);
      expect(readTexts(body)).toEqual([
        "asked by ● alice 3d ago",
        "1 push since · 2 files · +65 −12",
        "✗ checks: 1 of 2 failed (lint)",
      ]);
      expect(body.map(({ kind, most }) => [kind, most])).toEqual([
        ["words", undefined],
        ["words", 1],
        ["words", undefined],
      ]);
    });

    it("counts from the request made to the row's reviewer when several were made", () => {
      const asked = thread({
        kind: "pullRequest",
        reviewRequests: [
          { reviewer: bob, requester: alice, at: at("2026-09-25T09:00+02:00") },
          {
            reviewer: { team: "example-org/reviewers", members: [] },
            requester: carol,
            at: at("2026-09-28T10:00+02:00"),
          },
        ],
      });
      const row = measureRow({ ...overReview.wait, thread: asked });
      expect(
        readTexts(describeDetail(row, undefined, reading).body).at(0),
      ).toBe("asked by ● alice 3d ago");
      const team = measureRow({
        ...overReview.wait,
        thread: asked,
        owners: ["example-org/reviewers"],
      });
      expect(
        readTexts(describeDetail(team, undefined, reading).body).at(0),
      ).toBe("asked by ◐ carol 2h ago");
    });

    it("counts from when the wait began when no request is recorded, in plural, with one file", () => {
      const unasked = measureRow({
        ...overReview.wait,
        thread: thread({ kind: "pullRequest" }),
      });
      const detail = {
        ...overReviewDetail,
        files: overReviewDetail.files.slice(0, 1),
      };
      expect(readTexts(describeDetail(unasked, detail, reading).body)).toEqual([
        "asked 6d ago",
        "0 pushes since · 1 file · +40 −12",
        "✗ checks: 1 of 2 failed (lint)",
      ]);
    });

    it("says checks passed, are running, or that there are none, from the details", () => {
      const checks = (states: ("passing" | "running")[]) =>
        readTexts(
          describeDetail(
            overReview,
            {
              ...overReviewDetail,
              checks: states.map((state, place) => ({
                name: `c${place}`,
                state,
              })),
            },
            reading,
          ).body,
        ).at(2);
      expect(checks(["passing", "passing"])).toBe("checks passed 2 of 2");
      expect(checks(["passing", "running"])).toBe("checks running 1 of 2");
      expect(checks([])).toBe("no checks");
    });

    it("says what the snapshot knows of the checks before the details: passing, running, or none", () => {
      const snapshot = (checks?: "passing" | "running") =>
        readTexts(
          describeDetail(
            measureRow({
              ...overReview.wait,
              thread: { ...overReview.wait.thread, checks },
            }),
            undefined,
            reading,
          ).body,
        ).at(2);
      expect(snapshot("passing")).toBe("checks passed …");
      expect(snapshot("running")).toBe("checks running …");
      expect(snapshot()).toBe("no checks");
    });

    it("begins each line that waits on the details as the line the details give begins, so it only grows", () => {
      const cases = [
        ["failing", overReviewDetail.checks],
        ["running", [{ name: "c0", state: "running" as const }]],
        ["passing", [{ name: "c0", state: "passing" as const }]],
      ] as const;
      for (const [checks, detailChecks] of cases) {
        const row = measureRow({
          ...overReview.wait,
          thread: { ...overReview.wait.thread, checks },
        });
        const before = readTexts(describeDetail(row, undefined, reading).body);
        const after = readTexts(
          describeDetail(
            row,
            { ...overReviewDetail, checks: detailChecks },
            reading,
          ).body,
        );
        for (const [place, line] of before.entries()) {
          expect(after[place]?.startsWith(line.replace(/ …$/, ""))).toBe(true);
        }
      }
    });
  });

  describe("a close", () => {
    it("gives the age and owners, the last activity and who made it, and each label as group=value, from the snapshot", () => {
      const { body } = describeDetail(sharedClose, undefined, reading);
      expect(readTexts(body)).toEqual([
        "age 6d · owner ● alice, ● bob, ◐ carol-at-example-org",
        "last activity 3h ago · ● bob",
        "labels priority=high · kind=bug · area/icons",
      ]);
      expect(describeDetail(sharedClose, sharedCloseDetail, reading)).toEqual(
        describeDetail(sharedClose, undefined, reading),
      );
    });

    it("says unassigned, no labels, and no one when nobody wrote", () => {
      const { body } = describeDetail(measureRow({}), undefined, reading);
      expect(readTexts(body)).toEqual([
        "age 6d · owner unassigned",
        "last activity 6d ago",
        "labels none",
      ]);
    });
  });

  describe("a thread no wait runs on", () => {
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

    it("gives a closed thread its age, its assignees that are not bots as owners behind their marks, and its labels, then its stack lines", () => {
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
      expect(
        readTexts(describeDetail(resting, botted, reading).body).at(1),
      ).toBe(`last activity 3h ago · ■ ${exampleSync.login}`);
    });
  });

  describe("a repository whose own file is invalid", () => {
    it("names it first, in full, in the error colour, as its row writes ✗ file", () => {
      const row = measureRow({}, true);
      const [first] = describeDetail(row, undefined, reading).body;
      expect(readTexts(first ? [first] : [])).toEqual([
        "✗ invalid repository file",
      ]);
      expect(first?.pieces.at(0)?.fg).toBe(tokens["color.text.error"]);
      const resting = {
        repo: "example",
        thread: overReview.wait.thread,
        people: teamSettings.people,
        invalidFile: {
          text: "invalid repository file",
          kind: "words" as const,
        },
      };
      expect(
        readTexts(describeDetail(resting, sharedCloseDetail, reading).body).at(
          0,
        ),
      ).toBe("✗ invalid repository file");
      expect(
        readTexts(describeDetail(resting, undefined, reading).body),
      ).toEqual(["✗ invalid repository file", "loading…"]);
    });
  });

  describe("a stacked pull request", () => {
    it("ends with its place in the stack at once, and its neighbours once the details arrive, both dimmed", () => {
      const before = describeDetail(overReview, undefined, reading).stack;
      expect(readTexts(before)).toEqual([
        "example stack 3 · 2 of 3 · → main",
        "…",
      ]);
      const { stack } = describeDetail(overReview, overReviewDetail, reading);
      expect(readTexts(stack)).toEqual([
        "example stack 3 · 2 of 3 · → main",
        "below #11 merged, above #13 close",
      ]);
      expect(stack.map(({ pieces }) => pieces.at(0)?.fg)).toEqual([
        tokens["color.text.muted"],
        tokens["color.text.muted"],
      ]);
    });

    it("holds its place to one line, where the repository's short name leaves first and the base branch is the one run cut", () => {
      const [place] = describeDetail(overReview, undefined, reading).stack;
      expect([place?.most, place?.drops, place?.cuts]).toEqual([1, [0], 2]);
      expect(place?.pieces.map(({ text }) => text)).toEqual([
        "example ",
        "stack 3 · 2 of 3 · → ",
        "main",
      ]);
    });

    it("calls an open neighbour with no running wait open, and leaves out one the details lack", () => {
      const { stack } = describeDetail(draftClose, overReviewDetail, {
        ...reading,
        waiting: {},
      });
      expect(readTexts(stack)).toEqual([
        "example stack 3 · 3 of 3 · → main",
        "below #12 open",
      ]);
    });

    it("gives only its place when the details list no neighbour, or it stands alone", () => {
      const { stack } = describeDetail(
        overReview,
        { ...overReviewDetail, stack: [] },
        reading,
      );
      expect(readTexts(stack)).toEqual(["example stack 3 · 2 of 3 · → main"]);
      const alone = measureRow({
        ...overReview.wait,
        thread: {
          ...overReview.wait.thread,
          stack: { number: 4, position: 1, size: 1, base: "main" },
        },
      });
      expect(
        readTexts(describeDetail(alone, undefined, reading).stack),
      ).toEqual(["example stack 4 · 1 of 1 · → main"]);
    });
  });
});

describe("describeDetail, for an owner the row cuts", () => {
  const ownedBy = (row: WaitRow, owners: readonly string[]) =>
    measureRow({ ...row.wait, owners });
  const firstLine = (row: WaitRow, detail?: ThreadDetail) =>
    readTexts(describeDetail(row, detail, reading).body).at(0);

  it("names the owner whole, first, for every kind of wait", () => {
    const owners = ["carol-at-example-org"];
    expect(firstLine(ownedBy(soonReply, owners))).toBe(
      "owner carol-at-example-org",
    );
    expect(firstLine(ownedBy(overReview, owners), overReviewDetail)).toBe(
      "owner carol-at-example-org",
    );
    expect(firstLine(ownedBy(draftClose, owners))).toBe(
      "age 6d · owner carol-at-example-org",
    );
  });

  it("names every owner whole, behind their marks, when the row cuts any of them", () => {
    const row = ownedBy(sharedClose, ["alice", "bob", "carol-at-example-org"]);
    const reply = measureRow({ ...row.wait, kind: "response" });
    expect(firstLine(reply)).toBe(
      "owner ● alice, ● bob, ◐ carol-at-example-org",
    );
  });

  it("leaves a team the row cuts to the row, with no owner line", () => {
    const row = ownedBy(overReview, ["example-org/reviewers"]);
    expect(firstLine(row)).toBe("asked by ● alice 3d ago");
  });

  it("names every owner whole, a team among them, when the row cuts a person's login", () => {
    const row = ownedBy(overReview, [
      "example-org/reviewers",
      "carol-at-example-org",
    ]);
    expect(firstLine(row)).toBe(
      "owner example-org/reviewers, carol-at-example-org",
    );
  });
});
