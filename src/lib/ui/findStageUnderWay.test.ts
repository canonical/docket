import { describe, expect, it } from "vitest";
import type { RepoProgress } from "../cache/index.js";
import findStageUnderWay from "./findStageUnderWay.js";

const repo = "example-org/example-repo";
const docs = "example-org/example-docs";

describe("findStageUnderWay", () => {
  it("gives the first repository being read, with its place and pages", () => {
    const stages: RepoProgress[] = [
      { repo, stage: { kind: "done", threads: 3 } },
      { repo: docs, stage: { kind: "reading", fetched: 2, total: 3 } },
    ];
    expect(findStageUnderWay(stages)).toEqual({
      repo: docs,
      position: 2,
      count: 2,
      fetched: 2,
      total: 3,
    });
  });

  it("counts no pages for a repository checking for changes or reading its checks", () => {
    for (const kind of ["checking", "checks"] as const) {
      const stages: RepoProgress[] = [
        { repo, stage: { kind } },
        { repo: docs, stage: { kind: "waiting" } },
      ];
      expect(findStageUnderWay(stages)).toEqual({
        repo,
        position: 1,
        count: 2,
        fetched: 0,
        total: 0,
      });
    }
  });

  it("gives nothing while every repository waits, is done, paused or failed", () => {
    const stages: RepoProgress[] = [
      { repo, stage: { kind: "waiting" } },
      { repo, stage: { kind: "done", threads: 0 } },
      { repo, stage: { kind: "paused" } },
      { repo, stage: { kind: "failed" } },
    ];
    expect(findStageUnderWay(stages)).toBeUndefined();
    expect(findStageUnderWay([])).toBeUndefined();
  });
});
