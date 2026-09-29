import { describe, expect, it } from "vitest";
import {
  alice,
  at,
  bob,
  carol,
  dave,
  exampleSync,
  teamSettings,
  thread,
} from "../../testing/facts.js";
import findResponseStart from "./findResponseStart.js";
import type { Message } from "./types.js";

const { people } = teamSettings;
const opened = at("2026-09-22T10:00+02:00");
const message = (author: Message["author"], iso: string): Message => ({
  author,
  at: at(iso),
});

describe("findResponseStart", () => {
  it("starts at the opening of a thread someone outside the team opened", () => {
    expect(
      findResponseStart(thread({ author: dave }), people)?.started,
    ).toEqual(opened);
    expect(
      findResponseStart(thread({ author: carol }), people)?.started,
    ).toEqual(opened);
  });

  it("finds no wait on a thread a team member opened and nobody else wrote in", () => {
    expect(
      findResponseStart(thread({ author: alice }), people),
    ).toBeUndefined();
  });

  it("ends at any team member's comment, not only an assignee's", () => {
    const answered = thread({
      assignees: [alice],
      comments: [message(bob, "2026-09-22T11:00+02:00")],
    });
    expect(findResponseStart(answered, people)).toBeUndefined();
  });

  it("starts again at the first comment from outside the team after the team's reply", () => {
    const reopened = thread({
      comments: [
        message(alice, "2026-09-22T11:00+02:00"),
        message(dave, "2026-09-22T12:00+02:00"),
        message(carol, "2026-09-22T13:00+02:00"),
      ],
    });
    expect(findResponseStart(reopened, people)?.started).toEqual(
      at("2026-09-22T12:00+02:00"),
    );
  });

  it("dates from the earliest message still unanswered", () => {
    const waiting = thread({
      comments: [message(dave, "2026-09-23T09:00+02:00")],
    });
    expect(findResponseStart(waiting, people)?.started).toEqual(opened);
  });

  it("reads the messages in time order, whatever order they are given in", () => {
    const shuffled = thread({
      author: alice,
      comments: [
        message(bob, "2026-09-22T12:00+02:00"),
        message(dave, "2026-09-22T11:00+02:00"),
      ],
    });
    expect(findResponseStart(shuffled, people)).toBeUndefined();
  });

  it("lets a bot's comment neither start nor end the wait", () => {
    const botOnly = thread({
      author: alice,
      comments: [message(exampleSync, "2026-09-22T10:01+02:00")],
    });
    expect(findResponseStart(botOnly, people)).toBeUndefined();
    const botAfter = thread({
      comments: [message(exampleSync, "2026-09-22T10:01+02:00")],
    });
    expect(findResponseStart(botAfter, people)?.started).toEqual(opened);
  });

  it("counts a team member's review as a reply, and a review from outside as a message to answer", () => {
    const reviewed = thread({
      kind: "pullRequest",
      reviews: [message(alice, "2026-09-22T11:00+02:00")],
    });
    expect(findResponseStart(reviewed, people)).toBeUndefined();
    const outside = thread({
      kind: "pullRequest",
      author: alice,
      reviews: [message(carol, "2026-09-22T11:00+02:00")],
    });
    expect(findResponseStart(outside, people)?.started).toEqual(
      at("2026-09-22T11:00+02:00"),
    );
  });

  it("awaits the reply to the thread's author while nobody outside the team wrote since", () => {
    const botAfter = thread({
      comments: [message(exampleSync, "2026-09-22T10:01+02:00")],
    });
    expect(findResponseStart(botAfter, people)?.author).toEqual(dave);
  });

  it("awaits the reply to the latest message from outside the team, dated from the earliest", () => {
    const waiting = thread({
      comments: [
        message(alice, "2026-09-22T11:00+02:00"),
        message(dave, "2026-09-22T12:00+02:00"),
        message(carol, "2026-09-22T13:00+02:00"),
        message(exampleSync, "2026-09-22T14:00+02:00"),
      ],
    });
    expect(findResponseStart(waiting, people)).toEqual({
      started: at("2026-09-22T12:00+02:00"),
      author: carol,
    });
  });

  it("takes the team from the configuration only", () => {
    const answered = thread({
      comments: [message(carol, "2026-09-22T11:00+02:00")],
    });
    expect(findResponseStart(answered, people)?.started).toEqual(opened);
    const withCarol = new Map([...people, ["carol", "team" as const]]);
    expect(findResponseStart(answered, withCarol)).toBeUndefined();
  });
});
