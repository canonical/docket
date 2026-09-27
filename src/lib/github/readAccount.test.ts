import { describe, expect, it } from "vitest";
import { bot, restUser, user } from "../../testing/github.js";
import readAccount from "./readAccount.js";

describe("readAccount", () => {
  it("tells a bot by the account type GraphQL or REST records", () => {
    expect(
      [
        user("alice"),
        bot("example-sync"),
        restUser("bob"),
        restUser("example-app[bot]", "Bot"),
      ].map(readAccount),
    ).toEqual([
      { login: "alice", type: "user" },
      { login: "example-sync", type: "bot" },
      { login: "bob", type: "user" },
      { login: "example-app[bot]", type: "bot" },
    ]);
  });

  it("reads a deleted account as ghost", () => {
    expect(readAccount(null)).toEqual({ login: "ghost", type: "user" });
  });
});
