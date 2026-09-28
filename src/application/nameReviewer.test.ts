import { describe, expect, it } from "vitest";
import { bob } from "../testing/facts.js";
import nameReviewer from "./nameReviewer.js";

describe("nameReviewer", () => {
  it("names a person by login and a team as org/team", () => {
    expect(nameReviewer(bob)).toBe("bob");
    expect(nameReviewer({ team: "example-org/reviewers" })).toBe(
      "example-org/reviewers",
    );
  });
});
