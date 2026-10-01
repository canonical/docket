import { describe, expect, it } from "vitest";
import listOwners from "./listOwners.js";

describe("listOwners", () => {
  it("gives the one owner, or every owner of a third line", () => {
    expect(listOwners({ owner: { text: "alice", kind: "person" } })).toEqual([
      "alice",
    ]);
    const owners = {
      fields: [
        { text: "alice", kind: "person" },
        { text: "bob", kind: "person" },
      ],
    } as const;
    expect(listOwners({ owners })).toEqual(["alice", "bob"]);
  });

  it("gives none when the row names no owner, and strips control sequences", () => {
    expect(listOwners({})).toEqual([]);
    expect(
      listOwners({ owner: { text: "bob\u001b[2J", kind: "person" } }),
    ).toEqual(["bob"]);
  });
});
