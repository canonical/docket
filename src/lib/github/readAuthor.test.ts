import { describe, expect, it } from "vitest";
import { bot, user } from "../../testing/github.js";
import readAuthor from "./readAuthor.js";

describe("readAuthor", () => {
  it("reads a member or owner of the organisation as a member", () => {
    for (const association of ["MEMBER", "OWNER"]) {
      expect(
        readAuthor({ author: user("alice"), authorAssociation: association }),
      ).toEqual({ login: "alice", type: "user", member: true });
    }
  });

  it("reads any other tie to the repository as not a member", () => {
    for (const association of ["COLLABORATOR", "CONTRIBUTOR", "NONE"]) {
      expect(
        readAuthor({ author: user("dave"), authorAssociation: association })
          .member,
      ).toBe(false);
    }
  });

  it("reads a bot by its account type", () => {
    expect(
      readAuthor({ author: bot("example-sync"), authorAssociation: "NONE" }),
    ).toEqual({ login: "example-sync", type: "bot", member: false });
  });

  it("reads a deleted writer as ghost", () => {
    expect(readAuthor({ author: null, authorAssociation: "NONE" })).toEqual({
      login: "ghost",
      type: "user",
      member: false,
    });
  });
});
