import { describe, expect, it } from "vitest";
import {
  activityGroupings,
  describeAddress as describeActivityAddress,
  listEvents,
} from "../../lib/activity/index.js";
import type { CacheStatus, RepoStage } from "../../lib/cache/index.js";
import type { WindowEvent } from "../../lib/events/index.js";
import {
  describeAddress,
  listWaits,
  owedGroupings,
} from "../../lib/owed/index.js";
import {
  CountsLine,
  StatusLine,
  ThreadRow,
} from "../../lib/ui/component/index.js";
import describeStage from "../../lib/ui/component/RefreshStages/describeStage.js";
import describeDetails from "../../lib/ui/component/StatusLine/describeDetails.js";
import describeStatus from "../../lib/ui/component/StatusLine/describeStatus.js";
import { minColumns } from "../../lib/ui/constants.js";
import { PaneHeader } from "../../lib/ui/subcomponent/index.js";
import type { Wait } from "../../lib/waits/index.js";
import { activityNow } from "../activity.js";
import { alice, teamSettings, thread } from "../facts.js";
import { longReview } from "../long.js";
import { recordedNow } from "../recorded.js";
import { draftClose, overReview, soonReply } from "../rows.js";
import { draw } from "../terminal.js";

const now = new Date("2026-09-28T12:00:00Z");
const idle: CacheStatus = {
  syncedAt: new Date("2026-09-28T11:01:00Z"),
  refreshing: false,
  whole: false,
  stages: [],
  fullRefreshAvailableAt: undefined,
  paused: undefined,
  failure: undefined,
};
const until = new Date("2026-09-28T23:59:00Z");
const failure = (code: string) =>
  Object.assign(new Error("failed"), { code, recovery: "refresh" });
const names = { "example-org/example-repo": "example" };
const stage = (kind: RepoStage) => [
  { repo: "example-org/example-repo", stage: kind },
];

/** A full refresh with three digits of pages, too wide for the narrowest pane. */
const fullRefresh: CacheStatus = {
  ...idle,
  whole: true,
  refreshing: true,
  stages: stage({ kind: "reading", fetched: 999, total: 999 }),
};

/** Each message the status line gives in docket's own words, at its widest. */
const messages: readonly CacheStatus[] = [
  idle,
  { ...idle, paused: { reason: "rateLimit", until } },
  { ...idle, syncedAt: undefined, paused: { reason: "rateLimit", until } },
  { ...idle, paused: { reason: "budget", until } },
  { ...idle, failure: failure("GITHUB_TIMED_OUT") as never },
  { ...idle, failure: failure("GITHUB_REQUEST_FAILED") as never },
  { ...idle, failure: failure("GITHUB_RATE_LIMITED") as never },
  {
    ...idle,
    syncedAt: undefined,
    failure: failure("GITHUB_TIMED_OUT") as never,
  },
  { ...idle, fullRefreshAvailableAt: new Date("2026-09-28T12:09:59Z") },
  fullRefresh,
  { ...fullRefresh, whole: false },
];

describe("docket's own words at the narrowest pane", () => {
  it("holds each status message whole, a full refresh without its pages, and the details' count, which leaves whole where they would meet", () => {
    for (const status of messages) {
      for (const attention of ["active", "idle"] as const) {
        const message = describeStatus(
          status,
          now,
          "UTC",
          names,
          undefined,
          attention,
        );
        const right = describeDetails(status, message, attention, false, {
          read: 999,
          asked: 999,
        });
        // A message with a part that gives way keeps the words without it.
        const words = message?.shorter ?? message?.text ?? "";
        for (const text of [words, right]) {
          expect(Bun.stringWidth(text), text).toBeLessThanOrEqual(minColumns);
        }
      }
    }
  });

  it("draws a full refresh's words whole once its pages give way", async () => {
    const screen = await draw(
      <StatusLine
        status={fullRefresh}
        now={now}
        timezone="UTC"
        names={names}
        width={minColumns}
      />,
      minColumns,
    );
    expect(screen.lines.at(0)).toBe("full refresh · example 1/1");
  });

  it("holds each mode's header whole, every grouping and window", async () => {
    const headers = [
      ...owedGroupings.map((grouping) =>
        describeAddress({ mode: "owed", grouping }),
      ),
      ...activityGroupings.flatMap((grouping) =>
        (["h", "d", "w"] as const).map((unit) =>
          describeActivityAddress({
            mode: "activity",
            grouping,
            window: { amount: 999, unit },
          }),
        ),
      ),
    ];
    for (const { title, address } of headers) {
      const screen = await draw(
        <PaneHeader title={title} address={address} width={minColumns} />,
        minColumns,
      );
      expect(screen.lines.at(0)).toMatch(
        new RegExp(
          address ? `^${title.text} +${address.text}$` : `^${title.text}$`,
        ),
      );
    }
  });

  it("holds the counts owed and activity build whole, with three digits in every state", async () => {
    const many = (wait: Wait) => Array.from({ length: 999 }, () => wait);
    const owed = listWaits(
      [
        {
          repo: { name: "example", repo: "example-org/example-repo", tags: [] },
          time: teamSettings.time,
          people: teamSettings.people,
          yours: [],
          waits: [
            ...many(overReview.wait),
            ...many(soonReply.wait),
            ...many(draftClose.wait),
          ],
        },
      ],
      recordedNow,
    ).summary;
    const activity = listEvents(
      [
        {
          repo: { name: "example", repo: "example-org/example-repo", tags: [] },
          people: teamSettings.people,
          threads: [],
          events: Array.from(
            { length: 999 },
            (_, number): WindowEvent => ({
              thread: thread({ number }),
              kind: "pushed",
              commits: 1,
              actor: alice,
              at: activityNow,
              bot: false,
            }),
          ),
        },
      ],
      activityNow,
    ).summary;
    for (const summary of [owed, activity]) {
      const screen = await draw(
        <CountsLine summary={summary} width={minColumns} />,
        minColumns,
      );
      expect(screen.lines.at(0)).toBe(summary.text);
    }
    expect(owed.text).toBe("999 over · 999 soon · 999 on track");
    expect(activity.text).toBe("999 threads · 999 events");
  });

  it("holds each first-run stage in the 20 cells its column keeps", () => {
    const stages: readonly RepoStage[] = [
      { kind: "waiting" },
      { kind: "checking" },
      { kind: "reading", fetched: 99, total: 99 },
      { kind: "checks", fetched: 99, total: 99 },
      { kind: "done", threads: 9999, fetched: 99, total: 99 },
      { kind: "paused", reason: "budget" },
      { kind: "paused", reason: "rateLimit" },
    ];
    for (const each of stages) {
      const text = describeStage(each)
        .map((piece) => piece.text)
        .join("");
      expect(Bun.stringWidth(text), text).toBeLessThanOrEqual(20);
    }
  });

  it("holds a row's kinds and distance whole beside the longest reference", async () => {
    const screen = await draw(
      <ThreadRow row={longReview} width={minColumns} />,
      minColumns,
    );
    expect(screen.lines.at(0)).toMatch(/ PR review 1d over$/);
  });
});
