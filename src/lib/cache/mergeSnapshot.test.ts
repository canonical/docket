import { describe, expect, it } from "vitest";
import { thread } from "../../testing/facts.js";
import mergeSnapshot from "./mergeSnapshot.js";

describe("mergeSnapshot", () => {
  it("replaces a changed thread and adds a new one", () => {
    const merged = mergeSnapshot(
      [thread({ number: 1 }), thread({ number: 2 })],
      [thread({ number: 2, title: "Renamed" }), thread({ number: 3 })],
    );
    expect(merged).toEqual([
      thread({ number: 1 }),
      thread({ number: 2, title: "Renamed" }),
      thread({ number: 3 }),
    ]);
  });

  it("drops a thread that closed", () => {
    expect(
      mergeSnapshot(
        [thread({ number: 1 })],
        [thread({ number: 1, open: false })],
      ),
    ).toEqual([]);
  });

  it("keeps a discussion apart from an issue with the same number", () => {
    const discussion = thread({ number: 1, kind: "discussion" });
    expect(mergeSnapshot([thread({ number: 1 })], [discussion])).toEqual([
      thread({ number: 1 }),
      discussion,
    ]);
  });
});
