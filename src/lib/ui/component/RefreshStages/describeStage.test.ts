import { describe, expect, it } from "vitest";
import { providerError } from "../../../../testing/provider.js";
import { tokens } from "../../../tokens/index.js";
import describeStage from "./describeStage.js";

const words = (stage: Parameters<typeof describeStage>[0]) =>
  describeStage(stage)
    .map(({ text }) => text)
    .join("");

describe("describeStage", () => {
  it("says what the refresh is doing to a repository, plainly, naming the page being read, and no pages before it knows how many", () => {
    expect(words({ kind: "checking" })).toBe("checking for changes");
    expect(words({ kind: "reading", fetched: 1, total: 3 })).toBe(
      "reading page 2/3",
    );
    expect(words({ kind: "reading", fetched: 3, total: 3 })).toBe(
      "reading page 3/3",
    );
    expect(words({ kind: "reading", fetched: 0, total: 0 })).toBe("reading");
    expect(words({ kind: "checks", fetched: 3, total: 3 })).toBe(
      "reading checks",
    );
    expect(describeStage({ kind: "checking" }).at(0)?.fg).toBe(
      tokens["color.text"],
    );
  });

  it("counts the threads a repository holds once done", () => {
    const done = { kind: "done", fetched: 1, total: 1 } as const;
    expect(words({ ...done, threads: 89 })).toBe("✓ 89 threads");
    expect(words({ ...done, threads: 1 })).toBe("✓ 1 thread");
    expect(words({ ...done, threads: 0 })).toBe("✓ 0 threads");
  });

  it("dims a repository waiting or paused, and says why it paused: the budget or the rate limit", () => {
    expect(describeStage({ kind: "waiting" })).toEqual([
      { text: "waiting", fg: tokens["color.text.muted"] },
    ]);
    expect(words({ kind: "paused", reason: "budget" })).toBe(
      "paused: budget low",
    );
    expect(describeStage({ kind: "paused", reason: "rateLimit" })).toEqual([
      { text: "paused: rate limit", fg: tokens["color.text.muted"] },
    ]);
  });

  it("gives a failure's reason without its full stop, in the error colour", () => {
    const error = providerError("GITHUB_TIMED_OUT");
    expect(describeStage({ kind: "failed", error })).toEqual([
      {
        text: "✗ failed: The provider failed with GITHUB_TIMED_OUT",
        fg: tokens["color.text.error"],
      },
    ]);
  });
});
