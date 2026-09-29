import { describe, expect, it } from "vitest";
import { alice, bob, carol, dave, thread } from "../testing/facts.js";
import gatherNamed from "./gatherNamed.js";

const at = new Date("2026-09-22T12:00+02:00");

describe("gatherNamed", () => {
  it("names each writer and each requested team by its lowercase name, the first one met kept", () => {
    const first = thread({
      author: dave,
      comments: [{ author: carol, at }],
      reviews: [{ author: { ...bob, login: "Bob" }, at }],
      reviewRequests: [
        { reviewer: alice, at },
        { reviewer: { team: "example-org/UI", members: ["alice"] }, at },
      ],
    });
    const second = thread({
      number: 2,
      author: { ...carol, member: false },
      reviewRequests: [
        { reviewer: { team: "example-org/ui", members: [] }, at },
      ],
    });
    const { writers, teams } = gatherNamed([first, second]);
    expect([...writers.keys()]).toEqual(["dave", "carol", "bob"]);
    expect(writers.get("carol")).toEqual(carol);
    expect([...teams.entries()]).toEqual([
      ["example-org/ui", { team: "example-org/UI", members: ["alice"] }],
    ]);
  });
});
