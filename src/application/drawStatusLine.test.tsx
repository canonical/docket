import { describe, expect, it } from "vitest";
import type { CacheStatus } from "../lib/cache/index.js";
import { settleStatus } from "../testing/cache.js";
import { providerError } from "../testing/provider.js";
import { recordedNow, recordedRepos } from "../testing/recorded.js";
import { draw } from "../testing/terminal.js";
import drawStatusLine, { type StatusLineState } from "./drawStatusLine.js";

/** An active pane, synced two minutes ago, with nothing else to say. */
const synced: StatusLineState = {
  problem: undefined,
  status: settleStatus(recordedNow),
  failure: undefined,
  action: undefined,
  attention: "active",
  details: undefined,
  now: recordedNow,
  timezone: "Europe/Paris",
  watched: recordedRepos,
  width: 40,
};

/** The first line drawn for `state`. */
async function drawFor(state: Partial<StatusLineState>) {
  const screen = await draw(drawStatusLine({ ...synced, ...state }), 40);
  return screen.lines.at(0);
}

describe("drawStatusLine", () => {
  it("says how old the data is", async () => {
    expect(await drawFor({})).toBe("synced 2m ago");
  });

  it("names a failure that leaves the rows held as a failed refresh, with the data's age", async () => {
    const failure = providerError("GITHUB_TIMED_OUT");
    expect(await drawFor({ failure })).toBe("✗ offline · data from 11:58");
  });

  it("says the rate limit paused reading when activity's events are refused for it, with rows held", async () => {
    const failure = providerError("GITHUB_RATE_LIMITED");
    expect(await drawFor({ failure })).toBe("paused: rate limit");
  });

  it("says nothing of the cache while a problem stands in for the list", async () => {
    const problem = {
      code: "GH_NOT_INSTALLED",
      message: "gh is not installed.",
      recovery: "install gh",
    } as const;
    expect(await drawFor({ problem })).toBe("");
  });

  it("names the repository by its short name", async () => {
    const status: CacheStatus = {
      ...settleStatus(recordedNow),
      refreshing: true,
      whole: true,
      stages: [
        {
          repo: "example-org/example-repo",
          stage: { kind: "done", threads: 2, fetched: 1, total: 1 },
        },
        {
          repo: "example-org/example-docs",
          stage: { kind: "reading", fetched: 1, total: 3 },
        },
      ],
    };
    expect(await drawFor({ status })).toBe(
      "full refresh · docs 2/2 · pages 2/4",
    );
  });

  it("counts the details read of those asked for", async () => {
    const line = await drawFor({ details: { read: 2, asked: 3 } });
    expect(line).toBe(`synced 2m ago${" ".repeat(16)}details 2/3`);
  });
});
