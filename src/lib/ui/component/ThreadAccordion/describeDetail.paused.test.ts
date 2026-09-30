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
  bob,
  carol,
  dave,
  teamSettings,
  thread,
} from "../../../../testing/facts.js";
import { recordedNow } from "../../../../testing/recorded.js";
import {
  measureRow,
  overReview,
  sharedClose,
  soonReply,
} from "../../../../testing/rows.js";
import type { WaitRow } from "../../../owed/index.js";
import type { ThreadDetail } from "../../../provider/index.js";
import type { Thread } from "../../../waits/index.js";
import describeDetail from "./describeDetail.js";
import type { DetailLine } from "./types.js";

const reading = {
  now: recordedNow,
  timezone: "Europe/Paris",
  waiting: { "example#13": "close" },
};

/** Each line's text, its runs joined, a no-break space read as the space it shows. */
const texts = (lines: readonly DetailLine[]) =>
  lines.map(({ pieces }) =>
    pieces
      .map(({ text }) => text)
      .join("")
      .replaceAll("\u00a0", " "),
  );

describe("describeDetail, while reading is paused", () => {
  it("gives a reply, a review and a close as the snapshot gives them while the details are read", () => {
    for (const [row, detail] of [
      [soonReply, soonReplyDetail],
      [overReview, overReviewDetail],
      [sharedClose, sharedCloseDetail],
    ] as const) {
      expect(describeDetail(row, pauseDetail(detail), reading)).toEqual(
        describeDetail(row, undefined, reading),
      );
    }
  });

  // bob's review wait on dave's pull request, started where the waits begin
  // it: at the latest request, or at dave's latest push after bob's review.
  const reviewOf = (started: Date, facts: Partial<Thread>) =>
    measureRow({
      thread: thread({
        number: 12,
        kind: "pullRequest",
        checks: "failing",
        ...facts,
      }),
      kind: "review",
      owners: ["bob"],
      started,
    });
  // The first two lines paused, then read with the requests given.
  const grows = (row: WaitRow, requests: ThreadDetail["requests"]) =>
    [pauseDetail(overReviewDetail), { ...overReviewDetail, requests }].map(
      (detail) => texts(describeDetail(row, detail, reading).body).slice(0, 2),
    );

  it("counts the same pushes paused and read, after a review and pushes, or a second request", () => {
    const row = reviewOf(at("2026-09-24T09:00+02:00"), {
      reviewRequests: [{ reviewer: bob, at: at("2026-09-21T09:00+02:00") }],
      reviews: [{ author: bob, at: at("2026-09-22T09:00+02:00") }],
      pushes: [
        { author: dave, at: at("2026-09-23T09:00+02:00") },
        { author: dave, at: at("2026-09-24T09:00+02:00") },
      ],
    });
    expect(
      grows(row, [
        { reviewer: bob, requester: alice, at: at("2026-09-21T09:00+02:00") },
      ]),
    ).toEqual([
      ["asked 7d ago", "2 pushes since · …"],
      ["asked 7d ago", "2 pushes since · 2 files · +65 −12"],
    ]);
    // Asked twice: the snapshot holds the latest request, and its asker.
    const again = reviewOf(at("2026-09-24T09:00+02:00"), {
      reviewRequests: [
        { reviewer: bob, requester: carol, at: at("2026-09-24T09:00+02:00") },
      ],
      pushes: [{ author: dave, at: at("2026-09-22T09:00+02:00") }],
    });
    expect(
      grows(again, [
        { reviewer: bob, requester: alice, at: at("2026-09-21T09:00+02:00") },
        { reviewer: bob, requester: carol, at: at("2026-09-24T09:00+02:00") },
      ]),
    ).toEqual([
      ["asked by ◐ carol 4d ago", "0 pushes since · …"],
      ["asked by ◐ carol 4d ago", "0 pushes since · 2 files · +65 −12"],
    ]);
  });

  it("gives a thread no wait runs on its close body from the snapshot, and its stack's neighbours pending", () => {
    const resting = {
      repo: "example",
      thread: overReview.wait.thread,
      people: teamSettings.people,
    };
    const { body, stack } = describeDetail(
      resting,
      pauseDetail(sharedCloseDetail),
      reading,
    );
    expect(texts(body)).toEqual(
      texts(describeDetail(resting, sharedCloseDetail, reading).body),
    );
    expect(texts(stack)).toEqual(["example stack 3 · 2 of 3 · → main", "…"]);
  });
});
