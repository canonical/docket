import { describe, expect, it } from "vitest";
import { alice, at, bob } from "../testing/facts.js";
import { parserFix } from "../testing/recorded.js";
import composeDetail from "./composeDetail.js";

describe("composeDetail", () => {
  it("gives the thread's times, labels and assignees, and its comments and reviews oldest first, without their text", () => {
    const thread = {
      ...parserFix,
      reviews: [{ author: bob, at: at("2026-09-24T09:00+02:00") }],
    };
    expect(composeDetail(thread)).toEqual({
      createdAt: parserFix.createdAt,
      updatedAt: parserFix.updatedAt,
      labels: ["kind=bug"],
      assignees: [alice],
      messages: [
        { author: bob, at: at("2026-09-24T09:00+02:00"), body: "" },
        {
          author: parserFix.author,
          at: at("2026-09-25T09:00+02:00"),
          body: "",
        },
      ],
      requests: [],
      files: [],
      checks: [],
      partial: true,
    });
  });
});
