import { describe, expect, it } from "vitest";
import { providerError } from "../../testing/provider.js";
import type { RepoProgress } from "../cache/index.js";
import findStageUnderWay from "./findStageUnderWay.js";

const repo = "example-org/example-repo";
const docs = "example-org/example-docs";
const site = "example-org/example-site";

describe("findStageUnderWay", () => {
  it("gives the repository being read, with its place", () => {
    const stages: RepoProgress[] = [
      { repo, stage: { kind: "done", threads: 3, fetched: 1, total: 1 } },
      { repo: docs, stage: { kind: "reading", fetched: 2, total: 3 } },
      { repo: site, stage: { kind: "waiting" } },
    ];
    expect(findStageUnderWay(stages)).toEqual({
      repo: docs,
      position: 2,
      count: 3,
    });
  });

  it("gives a repository checking for changes", () => {
    const stages: RepoProgress[] = [
      { repo, stage: { kind: "checking" } },
      { repo: docs, stage: { kind: "waiting" } },
    ];
    expect(findStageUnderWay(stages)).toEqual({ repo, position: 1, count: 2 });
  });

  it("keeps the last repository reached while the checks of an earlier one are read", () => {
    const stages: RepoProgress[] = [
      { repo, stage: { kind: "checks", fetched: 2, total: 2 } },
      { repo: docs, stage: { kind: "done", threads: 0, fetched: 3, total: 3 } },
    ];
    expect(findStageUnderWay(stages)).toEqual({
      repo: docs,
      position: 2,
      count: 2,
    });
  });

  it("gives nothing while every repository waits, is done, paused or failed, or none is watched", () => {
    const stages: RepoProgress[] = [
      { repo, stage: { kind: "done", threads: 0, fetched: 0, total: 0 } },
      { repo, stage: { kind: "paused", reason: "budget" } },
      {
        repo,
        stage: { kind: "failed", error: providerError("GITHUB_TIMED_OUT") },
      },
      { repo, stage: { kind: "waiting" } },
    ];
    expect(findStageUnderWay(stages)).toBeUndefined();
    expect(
      findStageUnderWay([{ repo, stage: { kind: "waiting" } }]),
    ).toBeUndefined();
    expect(findStageUnderWay([])).toBeUndefined();
  });
});
