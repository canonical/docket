import { describe, expect, it } from "vitest";
import type { CacheStatus } from "../lib/cache/index.js";
import { tokens } from "../lib/tokens/index.js";
import { settleStatus } from "../testing/cache.js";
import { providerError } from "../testing/provider.js";
import { recordedNow, recordedRepos } from "../testing/recorded.js";
import { draw } from "../testing/terminal.js";
import drawFirstRun from "./drawFirstRun.js";

const repo = "example-org/example-repo";
const docs = "example-org/example-docs";

/** Nothing synced yet, with the stages given. */
const statusOf = (stages: CacheStatus["stages"]): CacheStatus => ({
  ...settleStatus(recordedNow),
  syncedAt: undefined,
  stages,
});

/** The first run's lines for `status`, at `width` columns. */
const drawAt = (status: CacheStatus | undefined, width = 40) =>
  draw(drawFirstRun({ status, watched: recordedRepos, width }), width, 8);

describe("drawFirstRun", () => {
  it("counts the pages across the repositories begun, so the total grows as each begins", async () => {
    const screen = await drawAt(
      statusOf([
        { repo, stage: { kind: "done", threads: 89, fetched: 4, total: 4 } },
        { repo: docs, stage: { kind: "reading", fetched: 1, total: 5 } },
      ]),
      60,
    );
    expect(screen.lines.slice(0, 4)).toEqual([
      "  refresh in progress…",
      "  example ✓ 89 threads",
      "  docs    reading page 1/5",
      `  ${"█".repeat(16)}${"░".repeat(13)} 5/9 pages`,
    ]);
  });

  it("gives the step that recovers from the failure a repository stopped on, under the repository lines, its reason wrapped", async () => {
    const error = providerError("GITHUB_TIMED_OUT");
    const screen = await drawAt(
      statusOf([
        { repo, stage: { kind: "done", threads: 2, fetched: 1, total: 1 } },
        { repo: docs, stage: { kind: "failed", error } },
      ]),
    );
    expect(screen.lines.slice(0, 6)).toEqual([
      "  refresh in progress…",
      "  example ✓ 2 threads",
      "  docs    ✗ failed: The provider failed",
      "          with GITHUB_TIMED_OUT",
      "  Recovery: try again",
      `  ${"█".repeat(28)} 1/1 pages`,
    ]);
    expect(screen.look("Recovery")?.fg).toBe(tokens["color.text"]);
  });

  it("draws no repository lines and no step before any repository has a stage", async () => {
    const screen = await drawAt(undefined);
    expect(screen.lines.slice(0, 3)).toEqual([
      "  refresh in progress…",
      `  ${"░".repeat(28)} 0/0 pages`,
      "",
    ]);
  });
});
