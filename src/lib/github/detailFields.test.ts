import { describe, expect, it } from "vitest";
import detailFields from "./detailFields.js";

describe("detailFields", () => {
  it("asks every kind of thread for its age, labels and latest comments", () => {
    for (const fields of Object.values(detailFields)) {
      expect(fields).toContain("createdAt updatedAt labels(first: 10)");
      expect(fields).toContain("comments(last: 3)");
    }
  });

  it("asks a discussion for no assignees, which it cannot have", () => {
    expect(detailFields.discussion).not.toContain("assignees");
    expect(detailFields.issue).toContain("assignees(first: 10)");
  });

  it("asks a pull request alone for its reviews, requests, files, checks and stack", () => {
    for (const list of [
      "reviews(",
      "timelineItems(",
      "files(",
      "contexts(",
      "stack {",
    ]) {
      expect(detailFields.pullRequest).toContain(list);
      expect(detailFields.issue).not.toContain(list);
    }
  });
});
