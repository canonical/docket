import { describe, expect, it } from "vitest";
import countPages from "./countPages.js";

const repo = "example-org/example-repo";
const docs = "example-org/example-docs";
const site = "example-org/example-site";

describe("countPages", () => {
  it("adds up the pages of the repositories begun, read and to read", () => {
    expect(
      countPages([
        { repo, stage: { kind: "done", threads: 89, fetched: 4, total: 4 } },
        { repo: docs, stage: { kind: "reading", fetched: 1, total: 5 } },
        { repo: site, stage: { kind: "waiting" } },
      ]),
    ).toEqual({ fetched: 5, total: 9 });
  });

  it("counts the pages of a repository whose checks are read, and none of one checking, paused or failed", () => {
    expect(
      countPages([
        { repo, stage: { kind: "checks", fetched: 2, total: 2 } },
        { repo: docs, stage: { kind: "checking" } },
        { repo: site, stage: { kind: "paused", reason: "budget" } },
      ]),
    ).toEqual({ fetched: 2, total: 2 });
    expect(countPages([])).toEqual({ fetched: 0, total: 0 });
  });
});
