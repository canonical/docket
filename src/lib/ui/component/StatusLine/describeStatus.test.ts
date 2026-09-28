import { describe, expect, it } from "vitest";
import type { CacheStatus } from "../../../cache/index.js";
import describeStatus from "./describeStatus.js";
import {
  FullRefresh,
  FullRefreshRefused,
  Offline,
  RateLimited,
  RefreshFailed,
  Refreshing,
  Synced,
} from "./StatusLine.stories.js";

const now = new Date("2026-09-28T12:00:00Z");
const names = { "example-org/example-repo": "example" };
const statusOf = (story: { args: { status?: CacheStatus } }) => {
  const { status } = story.args;
  if (!status) throw new Error("the story has no status");
  return status;
};
const describeAt = (status: CacheStatus, timezone = "UTC") =>
  describeStatus(status, now, timezone, names);

describe("describeStatus", () => {
  it("names a rate limit and when requests resume, in the time zone given", () => {
    expect(describeAt(statusOf(RateLimited), "Europe/Paris")).toEqual({
      kind: "error",
      text: "✗ rate limited · resumes 16:20",
    });
  });

  it("says docket is offline when GitHub gave no answer in time, with the time of the data shown", () => {
    expect(describeAt(statusOf(Offline))).toEqual({
      kind: "error",
      text: "✗ offline · data from 10:12",
    });
  });

  it("says docket is offline with no data yet", () => {
    const status = { ...statusOf(Offline), syncedAt: undefined };
    expect(describeAt(status)).toEqual({ kind: "error", text: "✗ offline" });
  });

  it("names any other failed refresh and the time of the data shown", () => {
    expect(describeAt(statusOf(RefreshFailed))).toEqual({
      kind: "error",
      text: "✗ refresh failed · data from 10:12",
    });
  });

  it("names a rate limit whose reset time is unknown, with no data yet", () => {
    const failure = Object.assign(new Error("limited"), {
      code: "GITHUB_RATE_LIMITED",
      recovery: "wait",
    } as const);
    const status = { ...statusOf(Synced), syncedAt: undefined, failure };
    expect(describeAt(status)).toEqual({
      kind: "error",
      text: "✗ rate limited",
    });
  });

  it("puts an error before a refresh in progress", () => {
    const status = { ...statusOf(RefreshFailed), refreshing: true };
    expect(describeAt(status)?.kind).toBe("error");
  });

  it("states a full refresh's repository by its short name and its pages", () => {
    expect(describeAt(statusOf(FullRefresh))).toEqual({
      kind: "progress",
      text: "full refresh · example 1/2 · pages 5/9",
    });
  });

  it("names a repository with no short name in full", () => {
    const status = statusOf(FullRefresh);
    const progress = status.fullRefresh && {
      ...status.fullRefresh,
      repo: "example-org/other",
    };
    expect(describeAt({ ...status, fullRefresh: progress })?.text).toBe(
      "full refresh · example-org/other 1/2 · pages 5/9",
    );
  });

  it("says a background refresh is running", () => {
    expect(describeAt(statusOf(Refreshing))).toEqual({
      kind: "refreshing",
      text: "refreshing…",
    });
  });

  it("says when a refused full refresh is available, in whole seconds", () => {
    expect(describeAt(statusOf(FullRefreshRefused))).toEqual({
      kind: "notice",
      text: "full refresh available in 42s",
    });
  });

  it("drops the notice once the cooldown is over", () => {
    const status = {
      ...statusOf(Synced),
      fullRefreshAvailableAt: new Date("2026-09-28T11:59:00Z"),
    };
    expect(describeAt(status)?.kind).toBe("freshness");
  });

  it("says the refresh cycle is paused to spare the budget, and until when", () => {
    const status: CacheStatus = {
      ...statusOf(Synced),
      paused: { until: new Date("2026-09-28T13:00:00Z"), reason: "budget" },
    };
    expect(describeAt(status)).toEqual({
      kind: "notice",
      text: "refresh paused · resumes 13:00",
    });
  });

  it("otherwise says how long ago the data was synced", () => {
    expect(describeAt(statusOf(Synced))).toEqual({
      kind: "freshness",
      text: "synced 2m ago",
    });
  });

  it("says nothing with no data and nothing happening", () => {
    expect(
      describeAt({ ...statusOf(Synced), syncedAt: undefined }),
    ).toBeUndefined();
  });
});
