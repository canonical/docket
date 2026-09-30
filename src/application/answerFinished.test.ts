import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type Home, makeHome, openSession } from "../testing/docket.js";
import { providerError } from "../testing/provider.js";
import { recordedProvider } from "../testing/recorded.js";
import answerFinished from "./answerFinished.js";

let home: Home;

beforeEach(async () => {
  home = await makeHome();
});

afterEach(async () => {
  await home.remove();
});

describe("answerFinished", () => {
  it("lists the threads that finished in the first configured window, by kind, marking the viewer", async () => {
    const { session, out } = openSession(home, ["finished"]);
    expect(await answerFinished(session)).toBe(0);
    expect(out()).toMatch(/^# finished · 72h · by kind\n/);
    expect(out()).toContain(
      "\n1 merged · 1 closed · 1 over target\n\n## ISSUES\n",
    );
    expect(out()).toContain('merged by "alice" (you)');
  });

  it("answers a second call within the maximum age from the cache, making no request", async () => {
    const snapshot = vi.fn(recordedProvider().snapshot);
    const events = vi.fn(recordedProvider().events);
    const provider = recordedProvider({ snapshot, events });
    await answerFinished(openSession(home, ["finished"], provider).session);
    const requests = () =>
      snapshot.mock.calls.length + events.mock.calls.length;
    const first = requests();
    expect(first).toBeGreaterThan(0);
    const { session, out } = openSession(home, ["finished"], provider);
    expect(await answerFinished(session)).toBe(0);
    expect(out()).toContain("\n1 merged · 1 closed · 1 over target\n");
    expect(requests()).toBe(first);
  });

  it("answers from the cache during a rate limit, with the warning once", async () => {
    await answerFinished(openSession(home, ["finished"]).session);
    const limited = recordedProvider({
      snapshot: () => Promise.reject(providerError("GITHUB_RATE_LIMITED")),
      events: () => Promise.reject(providerError("GITHUB_RATE_LIMITED")),
      viewer: () => Promise.reject(providerError("GITHUB_RATE_LIMITED")),
      budget: () => Promise.reject(providerError("GITHUB_RATE_LIMITED")),
    });
    const { session, out } = openSession(
      home,
      ["finished", "--max-age", "0"],
      limited,
    );
    expect(await answerFinished(session)).toBe(0);
    expect(out().split("## Warning: GITHUB_RATE_LIMITED\n")).toHaveLength(2);
    expect(out()).toContain("\n1 merged · 1 closed · 1 over target\n");
  });

  it("takes another configured window and grouping", async () => {
    const { session, out } = openSession(home, [
      "finished",
      "--window",
      "1w",
      "--by",
      "ending",
    ]);
    await answerFinished(session);
    expect(out()).toMatch(/^# finished · 1w · by ending\n/);
    expect(out()).toContain("\n## closed as completed\n");
  });

  it("refuses a window the configuration does not list", async () => {
    const { session } = openSession(home, ["finished", "--window", "24h"]);
    await expect(answerFinished(session)).rejects.toMatchObject({
      code: "USAGE_INVALID_VALUE",
      recovery: "run docket finished --help",
    });
  });

  it("refuses a grouping finished does not have", async () => {
    const { session } = openSession(home, ["finished"]);
    const invocation = { ...session.invocation, by: "owner" };
    await expect(
      answerFinished({ ...session, invocation }),
    ).rejects.toMatchObject({
      code: "USAGE_INVALID_VALUE",
      message: "`--by` takes kind, ending, repo, none, not `owner`.",
    });
  });

  it("says it has no data when the configuration watches no repository", async () => {
    const bare = await makeHome("version: 1\n");
    const { code, out } = await bare.call(["finished"]);
    await bare.remove();
    expect(code).toBe(0);
    expect(out).toContain("No data: the configuration watches no repository.");
    expect(out).toContain("nothing merged or closed in 24h");
  });
});
