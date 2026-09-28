import { describe, expect, it } from "vitest";
import type { CacheStatus } from "../../../cache/index.js";
import describeStatus from "./describeStatus.js";
import {
  ActionDone,
  ActionFailed,
  FullRefresh,
  FullRefreshRefused,
  Idle,
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
  it("follows how old the data is with the idle pane's state, and the key that wakes it", () => {
    const { status, attention } = Idle.args;
    expect(
      describeStatus(status, now, "UTC", names, undefined, attention),
    ).toEqual({
      kind: "freshness",
      text: "synced 25m ago · idle · any key wakes",
    });
  });

  it("says nothing of attention while the pane is active or waking", () => {
    const { status } = Idle.args;
    for (const attention of ["active", "waking"] as const) {
      expect(
        describeStatus(status, now, "UTC", names, undefined, attention)?.text,
      ).toBe("synced 25m ago");
    }
  });

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

  it("says docket is offline when a request got no answer at all", () => {
    const unreachable = Object.assign(
      new Error(
        "docket could not reach github.com: the request got no answer.",
      ),
      { code: "GITHUB_UNREACHABLE", recovery: "refresh" } as const,
    );
    const status = { ...statusOf(Offline), failure: unreachable };
    expect(describeAt(status)).toEqual({
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

  it("puts a failed action's result, marked ✗, before a refresh in progress", () => {
    const { status, action } = ActionFailed.args;
    expect(describeStatus(status, now, "UTC", names, action)).toEqual({
      kind: "actionFailed",
      text: "✗ could not open the browser",
    });
  });

  it("marks an action that went through ✓, before how old the data is", () => {
    const { status, action } = ActionDone.args;
    expect(describeStatus(status, now, "UTC", names, action)).toEqual({
      kind: "action",
      text: "✓ assigned alice",
    });
  });

  it("keeps an action's result for 5 seconds, then drops it", () => {
    const { status, action } = ActionFailed.args;
    const describeLater = (ms: number) =>
      describeStatus(
        status,
        new Date(now.getTime() + ms),
        "UTC",
        names,
        action,
      );
    expect(describeLater(3_999)?.kind).toBe("actionFailed");
    expect(describeLater(4_000)?.kind).toBe("refreshing");
  });

  it("puts an error before an action's result", () => {
    const { action } = ActionFailed.args;
    const status = statusOf(RefreshFailed);
    expect(describeStatus(status, now, "UTC", names, action)?.kind).toBe(
      "error",
    );
  });

  it("shows an action's result with no cache", () => {
    const { action } = ActionFailed.args;
    expect(describeStatus(undefined, now, "UTC", names, action)?.text).toBe(
      "✗ could not open the browser",
    );
    expect(describeStatus(undefined, now, "UTC", names)).toBeUndefined();
  });

  it("says nothing with no data and nothing happening", () => {
    expect(
      describeAt({ ...statusOf(Synced), syncedAt: undefined }),
    ).toBeUndefined();
  });
});
