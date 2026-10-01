import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type Home, makeHome, openSession } from "../testing/docket.js";
import { providerError } from "../testing/provider.js";
import { recordedProvider } from "../testing/recorded.js";
import answerActivity from "./answerActivity.js";

let home: Home;

beforeEach(async () => {
  home = await makeHome();
});

afterEach(async () => {
  await home.remove();
});

describe("answerActivity", () => {
  it("lists the events of the first configured window, by kind", async () => {
    const { session, out } = openSession(home, ["activity"]);
    expect(await answerActivity(session)).toBe(0);
    expect(out()).toMatch(/^# activity · 72h · by kind\n/);
    expect(out()).toContain("\n2 threads · 4 events\n\n## ISSUES\n");
  });

  it("answers a second call within the maximum age from the cache, making no request", async () => {
    const snapshot = vi.fn(recordedProvider().snapshot);
    const events = vi.fn(recordedProvider().events);
    const provider = recordedProvider({ snapshot, events });
    await answerActivity(openSession(home, ["activity"], provider).session);
    const requests = () =>
      snapshot.mock.calls.length + events.mock.calls.length;
    const first = requests();
    expect(first).toBeGreaterThan(0);
    const { session, out } = openSession(home, ["activity"], provider);
    expect(await answerActivity(session)).toBe(0);
    expect(out()).toContain("\n2 threads · 4 events\n");
    expect(requests()).toBe(first);
  });

  it("answers from the cached threads and events during a rate limit, with the warning once", async () => {
    await answerActivity(openSession(home, ["activity"]).session);
    const limited = recordedProvider({
      snapshot: () => Promise.reject(providerError("GITHUB_RATE_LIMITED")),
      events: () => Promise.reject(providerError("GITHUB_RATE_LIMITED")),
      readBudgets: () => ({}),
    });
    const { session, out } = openSession(
      home,
      ["activity", "--max-age", "0"],
      limited,
    );
    expect(await answerActivity(session)).toBe(0);
    expect(out().split("## Warning: GITHUB_RATE_LIMITED\n")).toHaveLength(2);
    expect(out()).toContain("\n2 threads · 4 events\n");
  });

  it("takes another configured window and grouping", async () => {
    const { session, out } = openSession(home, [
      "activity",
      "--window",
      "1w",
      "--by",
      "none",
    ]);
    await answerActivity(session);
    expect(out()).toMatch(/^# activity · 1w\n/);
  });

  it("refuses a window the configuration does not list", async () => {
    const { session } = openSession(home, ["activity", "--window", "24h"]);
    await expect(answerActivity(session)).rejects.toMatchObject({
      code: "USAGE_INVALID_VALUE",
      message:
        "`--window` takes one of the configured windows, 72h, 1w, not `24h`.",
    });
  });

  it("refuses a grouping activity does not have", async () => {
    const { session } = openSession(home, ["activity"]);
    const invocation = { ...session.invocation, by: "owner" };
    await expect(
      answerActivity({ ...session, invocation }),
    ).rejects.toMatchObject({
      code: "USAGE_INVALID_VALUE",
      message: "`--by` takes kind, repo, none, not `owner`.",
    });
  });

  it("says it has no data when the configuration watches no repository", async () => {
    const bare = await makeHome("version: 1\n");
    const { code, out } = await bare.call(["activity"]);
    await bare.remove();
    expect(code).toBe(0);
    expect(out).toContain("No data: the configuration watches no repository.");
  });
});
