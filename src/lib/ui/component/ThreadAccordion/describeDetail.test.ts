import { describe, expect, it } from "vitest";
import {
  overReviewDetail,
  sharedCloseDetail,
  soonReplyDetail,
} from "../../../../testing/details.js";
import { at, carol, thread } from "../../../../testing/facts.js";
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
      expect(
        texts(describeDetail(team, detail, reading).body).slice(0, 2),
      ).toEqual(["owner example-org/reviewers", "asked by carol 2h ago"]);
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
        { ...sharedCloseDetail, messages: [] },
        reading,
      );
      expect(texts(body)).toEqual([
        "age 6d · owner unassigned",
        "last activity 3h ago",
        "labels none",
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
});
