import { describe, expect, it } from "vitest";
import { longReview } from "../../testing/long.js";
import { draw } from "../../testing/terminal.js";
import {
  activityGroupings,
  describeAddress as describeActivityAddress,
} from "../activity/index.js";
import type { CacheStatus, RepoStage } from "../cache/index.js";
import { describeAddress, owedGroupings } from "../owed/index.js";
import { CountsLine, StatusLine, ThreadRow } from "./component/index.js";
import describeStage from "./component/RefreshStages/describeStage.js";
import describeDetails from "./component/StatusLine/describeDetails.js";
import describeStatus from "./component/StatusLine/describeStatus.js";
import { minColumns } from "./constants.js";
import { PaneHeader } from "./subcomponent/index.js";

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
];

describe("minColumns", () => {
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

  it("holds the counts whole with four digits in every state", async () => {
    const summary = "9999 over · 9999 soon · 9999 on track";
    const screen = await draw(
      <CountsLine
        summary={{ text: summary, kind: "words" }}
        width={minColumns}
      />,
      minColumns,
    );
    expect(screen.lines.at(0)).toBe(summary);
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
