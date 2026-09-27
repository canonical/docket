import { describe, expect, it } from "vitest";
import readReviewer from "./readReviewer.js";

describe("readReviewer", () => {
  it("reads a person by login", () => {
    expect(readReviewer({ __typename: "User", login: "alice" })).toEqual({
      login: "alice",
      type: "user",
    });
  });

  it("reads a bot by its account type", () => {
    expect(readReviewer({ __typename: "Bot", login: "example-sync" })).toEqual({
      login: "example-sync",
      type: "bot",
    });
  });

  it("reads a team by its organisation/team name", () => {
    expect(
      readReviewer({
        __typename: "Team",
        combinedSlug: "example-org/reviewers",
      }),
    ).toEqual({ team: "example-org/reviewers" });
  });

  it("gives nothing for a reviewer GitHub does not show", () => {
    expect(readReviewer(null)).toBeUndefined();
    expect(readReviewer({ __typename: "Mannequin" })).toBeUndefined();
  });
});
