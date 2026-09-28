import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type Home, makeHome, openSession } from "../testing/docket.js";
import { providerError } from "../testing/provider.js";
import {
  recordedEvents,
  recordedNow,
  recordedProvider,
} from "../testing/recorded.js";
import readEvents from "./readEvents.js";

let home: Home;

beforeEach(async () => {
  home = await makeHome();
});

afterEach(async () => {
  await home.remove();
});

const repo = "example-org/example-repo";
const since = new Date("2026-09-20T10:00:00Z");
const failing = (error: Error) =>
  recordedProvider({ events: () => Promise.reject(error) });

describe("readEvents", () => {
  it("gives the repository's events no older than the maximum age, with no warning", async () => {
    const read = await readEvents(
      openSession(home, ["activity"]).session,
      repo,
      since,
    );
    expect(read).toEqual({
      events: recordedEvents.filter(({ thread }) => thread.repo === repo),
      syncedAt: recordedNow,
      warnings: [],
    });
  });

  it("gives the cached events with the failure as a warning when GitHub fails", async () => {
    await readEvents(openSession(home, ["activity"]).session, repo, since);
    const { session } = openSession(
      home,
      ["activity", "--max-age", "0"],
      failing(providerError("GITHUB_RATE_LIMITED")),
    );
    const read = await readEvents(session, repo, since);
    expect(read.events).toHaveLength(3);
    expect(read.warnings).toEqual([
      {
        code: "GITHUB_RATE_LIMITED",
        message: "The provider failed with GITHUB_RATE_LIMITED.",
        recovery: "try again",
      },
    ]);
  });

  it("throws the failure when no events held reach back far enough, gh is not ready, or the failure has no name", async () => {
    const limited = providerError("GITHUB_RATE_LIMITED");
    await expect(
      readEvents(
        openSession(home, ["activity"], failing(limited)).session,
        repo,
        since,
      ),
    ).rejects.toBe(limited);
    await readEvents(openSession(home, ["activity"]).session, repo, since);
    for (const error of [
      providerError("GH_NOT_SIGNED_IN"),
      new TypeError("a defect"),
    ]) {
      const { session } = openSession(
        home,
        ["activity", "--max-age", "0"],
        failing(error),
      );
      await expect(readEvents(session, repo, since)).rejects.toBe(error);
    }
  });
});
