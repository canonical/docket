import { describe, expect, it } from "vitest";
import { notification } from "../../testing/inbox.js";
import type { Repo } from "../config/index.js";
import buildRow from "./buildRow.js";

const repos: Repo[] = [
  { name: "example", repo: "example-org/example-repo", tags: [] },
];
const now = new Date("2026-09-28T12:00:00Z");

describe("buildRow", () => {
  it("names a watched thread by its short name and number, with its reason and age", () => {
    expect(
      buildRow(
        notification({ updatedAt: new Date("2026-09-28T10:00:00Z") }),
        repos,
        now,
      ),
    ).toMatchObject({
      repo: "example",
      reference: { text: "example#12", kind: "identifier" },
      subjectKind: "pullRequest",
      kind: { text: "PR", kind: "words" },
      reason: { text: "review requested", kind: "words" },
      distance: { text: "2h", kind: "figure" },
      title: { text: "Fix the parser", kind: "title" },
      unread: true,
      url: "https://github.com/example-org/example-repo/pull/12",
    });
  });

  it("names an unwatched repository by its full name", () => {
    expect(
      buildRow(
        notification({
          repo: "other-org/other-repo",
          repoUrl: "https://github.com/other-org/other-repo",
        }),
        repos,
        now,
      ).reference.text,
    ).toBe("other-org/other-repo#12");
  });

  it("marks a failed workflow, and names its workflow and branch", () => {
    expect(
      buildRow(
        notification({
          reason: "ci_activity",
          workflow: { name: "CI", branch: "main", failed: true },
          subject: {
            title: "CI workflow run failed for main branch",
            kind: "workflow",
            url: "https://github.com/example-org/example-repo/actions",
          },
        }),
        repos,
        now,
      ),
    ).toMatchObject({
      reference: { text: "example workflow", kind: "identifier" },
      subjectKind: "workflow",
      kind: { text: "workflow", kind: "words" },
      reason: { text: "CI failed", kind: "words" },
      failed: true,
    });
  });

  it("names a workflow that did not fail by GitHub's reason", () => {
    const row = buildRow(
      notification({
        reason: "ci_activity",
        workflow: { name: "CI", branch: "main", failed: false },
        subject: {
          title: "CI workflow run succeeded for main branch",
          kind: "workflow",
          url: "https://github.com/example-org/example-repo/actions",
        },
      }),
      repos,
      now,
    );
    expect(row.reason.text).toBe("CI activity");
    expect(row.failed).toBeUndefined();
  });

  it("marks a failed workflow whose title docket cannot parse", () => {
    const row = buildRow(
      notification({
        reason: "ci_activity",
        subject: {
          title: "Run failed: CI - main (push)",
          kind: "workflow",
          url: "https://github.com/example-org/example-repo/actions",
        },
      }),
      repos,
      now,
    );
    expect(row.reason.text).toBe("CI failed");
    expect(row.failed).toBe(true);
  });

  it("names a subject docket cannot detail by its kind and says browser only", () => {
    expect(
      buildRow(
        notification({
          subject: {
            title: "Update dependency",
            kind: "release",
            url: "https://github.com/example-org/example-repo/releases",
          },
          reason: "subscribed",
        }),
        repos,
        now,
      ),
    ).toMatchObject({
      reference: { text: "example release", kind: "identifier" },
      subjectKind: "release",
      kind: { text: "release", kind: "words" },
      reason: { text: "browser only", kind: "words" },
      url: "https://github.com/example-org/example-repo/releases",
    });
  });
});
