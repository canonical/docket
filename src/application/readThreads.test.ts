import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type Home, makeHome, openSession } from "../testing/docket.js";
import { providerError } from "../testing/provider.js";
import {
  recordedNow,
  recordedProvider,
  recordedThreads,
} from "../testing/recorded.js";
import readThreads from "./readThreads.js";

let home: Home;

beforeEach(async () => {
  home = await makeHome();
});

afterEach(async () => {
  await home.remove();
});

const failing = (error: Error) =>
  recordedProvider({
    snapshot: () => Promise.reject(error),
    readBudgets: () => ({}),
  });

describe("readThreads", () => {
  it("gives the threads no older than the maximum age, with no warning", async () => {
    const read = await readThreads(openSession(home, ["owed"]).session);
    expect(read).toEqual({
      threads: recordedThreads,
      syncedAt: recordedNow,
      warnings: [],
    });
  });

  it("gives the cached threads with the failure as a warning when GitHub fails", async () => {
    await readThreads(openSession(home, ["owed"]).session);
    const { session } = openSession(
      home,
      ["owed", "--max-age", "0"],
      failing(providerError("GITHUB_TIMED_OUT")),
    );
    const read = await readThreads(session);
    expect(read.threads).toEqual(recordedThreads);
    expect(read.warnings).toEqual([
      {
        code: "GITHUB_TIMED_OUT",
        message: "The provider failed with GITHUB_TIMED_OUT.",
        recovery: "try again",
      },
    ]);
  });

  it("throws when there is no cached data, when gh is not ready, and on a defect", async () => {
    const none = openSession(
      home,
      ["owed"],
      failing(providerError("GITHUB_REQUEST_FAILED")),
    );
    await expect(readThreads(none.session)).rejects.toMatchObject({
      code: "GITHUB_REQUEST_FAILED",
    });
    await readThreads(openSession(home, ["owed"]).session);
    for (const error of [
      providerError("GH_NOT_SIGNED_IN"),
      new TypeError("a defect"),
    ]) {
      const { session } = openSession(
        home,
        ["owed", "--max-age", "0"],
        failing(error),
      );
      await expect(readThreads(session)).rejects.toBe(error);
    }
  });
});
