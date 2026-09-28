import { describe, expect, it } from "vitest";
import listOwners from "./listOwners.js";

describe("listOwners", () => {
  it("gives the one owner, or every owner of a third line", () => {
    expect(listOwners({ owner: { text: "alice", fit: "trimmed" } })).toEqual([
      "alice",
    ]);
    const owners = {
      fit: "wrapped",
      fields: [
        { text: "alice", fit: "trimmed" },
        { text: "bob", fit: "trimmed" },
      ],
    } as const;
    expect(listOwners({ owners })).toEqual(["alice", "bob"]);
  });

  it("gives none when the row names no owner, and strips control sequences", () => {
    expect(listOwners({})).toEqual([]);
    expect(
      listOwners({ owner: { text: "bob\u001b[2J", fit: "trimmed" } }),
    ).toEqual(["bob"]);
  });
});
