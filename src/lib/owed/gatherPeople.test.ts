import { describe, expect, it } from "vitest";
import {
  at,
  carol,
  dave,
  exampleSync,
  teamSettings,
  thread,
} from "../../testing/facts.js";
import gatherPeople from "./gatherPeople.js";

const { people } = teamSettings;
const said = (author: typeof carol) => ({
  author,
  at: at("2026-09-22T11:00Z"),
});

describe("gatherPeople", () => {
  it("keeps the settings' groups, and adds as internal a member seen opening, commenting or reviewing", () => {
    const threads = [
      thread({ author: carol }),
      thread({ comments: [said({ ...carol, login: "erin" })] }),
      thread({ reviews: [said({ ...carol, login: "Frank" })] }),
    ];
    expect([...gatherPeople(threads, people)]).toEqual([
      ["alice", "team"],
      ["bob", "team"],
      ["carol", "internal"],
      ["erin", "internal"],
      ["frank", "internal"],
    ]);
  });

  it("adds no one GitHub marks outside the organisation, nor a bot, nor over a listed group", () => {
    const listed = new Map([...people, ["carol", "external" as const]]);
    const threads = [
      thread({ author: carol }),
      thread({
        comments: [said(dave), said({ ...exampleSync, member: true })],
      }),
    ];
    expect(gatherPeople(threads, listed)).toEqual(listed);
  });

  it("adds as internal a member among the other authors given, but not a bot", () => {
    const authors = [
      { ...carol, login: "erin" },
      dave,
      { ...exampleSync, member: true },
    ];
    expect([...gatherPeople([], people, authors)]).toEqual([
      ["alice", "team"],
      ["bob", "team"],
      ["erin", "internal"],
    ]);
  });
});
