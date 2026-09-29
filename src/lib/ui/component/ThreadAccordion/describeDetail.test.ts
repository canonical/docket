import { describe, expect, it } from "vitest";
import {
  overReviewDetail,
  pauseDetail,
  sharedCloseDetail,
  soonReplyDetail,
} from "../../../../testing/details.js";
import {
  alice,
  at,
  carol,
  exampleSync,
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
import describeDetail from "./describeDetail.js";

const reading = {
  now: recordedNow,
  timezone: "Europe/Paris",
  waiting: { "example#13": "close" },
};

const texts = (lines: readonly { text: string }[]) =>
  lines.map(({ text }) => text);

describe("describeDetail", () => {
  describe("a reply", () => {
    it("gives who wrote the latest message and when, the message whole, then when the reply began", () => {
      const { body, stack } = describeDetail(
        soonReply,
        soonReplyDetail,
        reading,
      );
      expect(body).toEqual([
        { text: "dave · 1d ago", tone: "text" },
        {
          text: "It crashes as soon as it starts,\nbefore the first frame is drawn.",
          tone: "text",
        },
        {
          text: "waiting since Tue 10:00 · target 24h",
          tone: "text",
          optional: true,
        },
      ]);
      expect(stack).toEqual([]);
    });

    it("names the thread's author and its opening when no message is recorded", () => {
      const { body } = describeDetail(
        soonReply,
        { ...soonReplyDetail, messages: [] },
        reading,
      );
      expect(texts(body)).toEqual([
        "dave · 6d ago",
        "waiting since Tue 10:00 · target 24h",
      ]);
    });

    it("gives the opening's text as the latest message while nobody has commented", () => {
      const { wait } = soonReply;
      const opened: WaitRow = {
        ...soonReply,
        wait: { ...wait, thread: { ...wait.thread, text: "It crashes." } },
      };
      const { body } = describeDetail(
        opened,
        { ...soonReplyDetail, messages: [] },
        reading,
      );
      expect(texts(body)).toEqual([
        "dave · 6d ago",
        "It crashes.",
        "waiting since Tue 10:00 · target 24h",
      ]);
    });
  });

  describe("a review", () => {
    it("gives who asked and when, the pushes since, the files and lines, and failing checks as an error", () => {
      const { body } = describeDetail(overReview, overReviewDetail, reading);
      expect(body).toEqual([
        { text: "asked by alice 3d ago", tone: "text" },
        { text: "1 push since · 2 files · +65 −12", tone: "text" },
        { text: "✗ checks: 1 of 2 failed (lint)", tone: "error" },
      ]);
    });

    it("reads the request made to the row's reviewer when several were made", () => {
      const detail: ThreadDetail = {
        ...overReviewDetail,
        requests: [
          ...overReviewDetail.requests,
          {
            reviewer: { team: "example-org/reviewers" },
            requester: carol,
            at: at("2026-09-28T10:00+02:00"),
          },
        ],
      };
      const { body } = describeDetail(overReview, detail, reading);
      expect(body.at(0)?.text).toBe("asked by alice 3d ago");
      const team = measureRow({
        ...overReview.wait,
        owners: ["example-org/reviewers"],
      });
      expect(texts(describeDetail(team, detail, reading).body).at(0)).toBe(
        "asked by carol 2h ago",
      );
    });

    it("counts from when the wait began when no request is recorded, in plural", () => {
      const { body } = describeDetail(
        overReview,
        {
          ...overReviewDetail,
          requests: [],
          files: overReviewDetail.files.slice(0, 1),
        },
        reading,
      );
      expect(texts(body).slice(0, 2)).toEqual([
        "asked 6d ago",
        "1 push since · 1 file · +40 −12",
      ]);
      const quiet = measureRow({
        ...overReview.wait,
        thread: thread({ kind: "pullRequest", pushes: [] }),
      });
      expect(
        describeDetail(quiet, overReviewDetail, reading).body.at(1)?.text,
      ).toBe("0 pushes since · 2 files · +65 −12");
    });

    it("says checks passed, are running, or that there are none", () => {
      const checks = (states: ("passing" | "running")[]) =>
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
        ).body.at(2);
      expect(checks(["passing", "passing"])).toEqual({
        text: "checks passed 2 of 2",
        tone: "text",
      });
      expect(checks(["passing", "running"])?.text).toBe(
        "checks running 1 of 2",
      );
      expect(checks([])?.text).toBe("no checks");
    });
  });

  describe("a close", () => {
    it("gives the age and owners, the last activity and who spoke, and each label as group=value", () => {
      const { body } = describeDetail(sharedClose, sharedCloseDetail, reading);
      expect(texts(body)).toEqual([
        "age 6d · owner alice, bob, carol-at-example-org",
        "last activity 3h ago · bob",
        "labels priority=high · kind=bug · area/icons",
      ]);
    });

    it("says unassigned, no labels, and no speaker when there is none", () => {
      const row = measureRow({});
      const { body } = describeDetail(
        row,
        { ...sharedCloseDetail, messages: [], labels: [] },
        reading,
      );
      expect(texts(body)).toEqual([
        "age 6d · owner unassigned",
        "last activity 3h ago",
        "labels none",
      ]);
    });
  });

  describe("a thread no wait runs on", () => {
    it("gives the close body from its details, with the owners its row names", () => {
      const resting = {
        repo: "example",
        thread: sharedClose.wait.thread,
        owners: "alice, bob",
      };
      const { body } = describeDetail(resting, sharedCloseDetail, reading);
      expect(texts(body)).toEqual([
        "age 6d · owner alice, bob",
        "last activity 3h ago · bob",
        "labels priority=high · kind=bug · area/icons",
      ]);
    });

    it("gives a closed thread its age, its assignees that are not bots as owners, and its labels, then its stack lines", () => {
      const resting = { repo: "example", thread: overReview.wait.thread };
      const closed = { ...sharedCloseDetail, assignees: [alice, exampleSync] };
      expect(texts(describeDetail(resting, closed, reading).body)).toEqual([
        "age 6d · owner alice",
        "last activity 3h ago · bob",
        "labels priority=high · kind=bug · area/icons",
      ]);
      const unassigned = { ...sharedCloseDetail, assignees: [exampleSync] };
      expect(
        describeDetail(resting, unassigned, reading).body.at(0)?.text,
      ).toBe("age 6d · owner unassigned");
      expect(
        texts(describeDetail(resting, overReviewDetail, reading).stack),
      ).toEqual([
        "example stack 3 · 2 of 3 · → main",
        "below #11 merged, above #13 close",
      ]);
    });
  });

  describe("a stacked pull request", () => {
    it("ends with its place in the stack and its neighbours, dimmed", () => {
      const { stack } = describeDetail(overReview, overReviewDetail, reading);
      expect(stack).toEqual([
        { text: "example stack 3 · 2 of 3 · → main", tone: "muted" },
        { text: "below #11 merged, above #13 close", tone: "muted" },
      ]);
    });

    it("calls an open neighbour with no running wait open, and leaves out one the details lack", () => {
      const { stack } = describeDetail(draftClose, overReviewDetail, {
        ...reading,
        waiting: {},
      });
      expect(texts(stack)).toEqual([
        "example stack 3 · 3 of 3 · → main",
        "below #12 open",
      ]);
    });

    it("gives only its place when the details list no neighbour", () => {
      const { stack } = describeDetail(
        overReview,
        { ...overReviewDetail, stack: [] },
        reading,
      );
      expect(texts(stack)).toEqual(["example stack 3 · 2 of 3 · → main"]);
    });
  });
});

describe("describeDetail, while reading is paused", () => {
  it("ends a reply's text, which needs the read, in a pending line", () => {
    const { body } = describeDetail(
      soonReply,
      pauseDetail(soonReplyDetail),
      reading,
    );
    expect(body).toEqual([
      { text: "dave · 1d ago", tone: "text" },
      { text: "", tone: "text", pending: true },
      {
        text: "waiting since Tue 10:00 · target 24h",
        tone: "text",
        optional: true,
      },
    ]);
  });

  it("gives a review's pushes and checks from the snapshot, each line the start of the one the read gives, pending the rest", () => {
    const { body, stack } = describeDetail(
      overReview,
      pauseDetail(overReviewDetail),
      reading,
    );
    expect(body).toEqual([
      { text: "asked", tone: "text", pending: true },
      { text: "1 push since ·", tone: "text", pending: true },
      { text: "✗ checks:", tone: "error", pending: true },
    ]);
    expect(stack).toEqual([
      { text: "example stack 3 · 2 of 3 · → main", tone: "muted" },
      { text: "", tone: "muted", pending: true },
    ]);
    const full = describeDetail(overReview, overReviewDetail, reading);
    body.forEach((partial, place) => {
      expect(full.body.at(place)?.text.startsWith(`${partial.text} `)).toBe(
        true,
      );
    });
  });

  it("says a review's checks are running or passed, pending which, or that there are none", () => {
    const rollUp = (checks?: "passing" | "running") =>
      describeDetail(
        measureRow({
          ...overReview.wait,
          thread: { ...overReview.wait.thread, checks },
        }),
        pauseDetail(overReviewDetail),
        reading,
      ).body.at(2);
    expect(rollUp("running")).toEqual({
      text: "checks running",
      tone: "text",
      pending: true,
    });
    expect(rollUp("passing")?.text).toBe("checks passed");
    expect(rollUp()).toEqual({ text: "no checks", tone: "text" });
  });

  it("gives a close whole, since the snapshot holds all it shows", () => {
    const { body } = describeDetail(
      sharedClose,
      pauseDetail(sharedCloseDetail),
      reading,
    );
    expect(body).toEqual(
      describeDetail(sharedClose, sharedCloseDetail, reading).body,
    );
  });
});

describe("describeDetail, for an owner the row cuts", () => {
  const ownedBy = (row: WaitRow, owners: readonly string[]) =>
    measureRow({ ...row.wait, owners });
  const firstLine = (row: WaitRow, detail: ThreadDetail) =>
    texts(describeDetail(row, detail, reading).body).at(0);

  it("names the owner whole, first, for every kind of wait", () => {
    const owners = ["carol-at-example-org"];
    expect(firstLine(ownedBy(soonReply, owners), soonReplyDetail)).toBe(
      "owner carol-at-example-org",
    );
    expect(firstLine(ownedBy(overReview, owners), overReviewDetail)).toBe(
      "owner carol-at-example-org",
    );
    expect(firstLine(ownedBy(draftClose, owners), sharedCloseDetail)).toBe(
      "age 6d · owner carol-at-example-org",
    );
  });

  it("names every owner whole when the row cuts any of them", () => {
    const row = ownedBy(overReview, ["alice", "bob", "carol-at-example-org"]);
    expect(firstLine(row, overReviewDetail)).toBe(
      "owner alice, bob, carol-at-example-org",
    );
  });

  it("leaves a team the row cuts to the row, with no owner line", () => {
    const row = ownedBy(overReview, ["example-org/reviewers"]);
    expect(firstLine(row, overReviewDetail)).toBe("asked by alice 3d ago");
  });

  it("names every owner whole, a team among them, when the row cuts a person's login", () => {
    const row = ownedBy(overReview, [
      "example-org/reviewers",
      "carol-at-example-org",
    ]);
    expect(firstLine(row, overReviewDetail)).toBe(
      "owner example-org/reviewers, carol-at-example-org",
    );
  });
});
