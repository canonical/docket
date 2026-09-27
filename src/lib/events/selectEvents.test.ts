import { describe, expect, it } from "vitest";
import {
  alice,
  at,
  dave,
  exampleSync,
  teamSettings,
  thread,
} from "../../testing/facts.js";
import type { Account } from "../people/index.js";
import selectEvents, { type ThreadEvent } from "./selectEvents.js";

const { repo, number, kind, title } = thread();
const summary = { repo, number, kind, title };
const event = (iso: string, actor: Account = dave): ThreadEvent => ({
  thread: summary,
  kind: "commented",
  actor,
  at: at(iso),
});
const day = { amount: 24, unit: "h" } as const;

describe("selectEvents", () => {
  it("counts the window in working time, so the weekend stays inside it", () => {
    const monday = at("2026-09-28T10:00+02:00");
    const events = [
      event("2026-09-25T09:59+02:00"),
      event("2026-09-25T10:00+02:00"),
      event("2026-09-26T12:00+02:00"),
      event("2026-09-28T09:00+02:00"),
    ];
    expect(selectEvents(events, day, monday, teamSettings)).toEqual(
      events.slice(1).map((kept) => ({ ...kept, bot: false })),
    );
  });

  it("measures a window written in weeks on the working clock", () => {
    const friday = at("2026-10-02T10:00+02:00");
    const events = [
      event("2026-09-25T09:00+02:00"),
      event("2026-09-25T11:00+02:00"),
    ];
    const week = { amount: 1, unit: "w" } as const;
    expect(
      selectEvents(events, week, friday, teamSettings).map(({ at }) => at),
    ).toEqual([at("2026-09-25T11:00+02:00")]);
  });

  it("keeps the events of the team, the reader's own included, and marks the bots' ones", () => {
    const now = at("2026-09-22T12:00+02:00");
    const events = [
      event("2026-09-22T10:00+02:00", alice),
      event("2026-09-22T10:01+02:00", exampleSync),
    ];
    expect(
      selectEvents(events, day, now, teamSettings).map(({ actor, bot }) => [
        actor.login,
        bot,
      ]),
    ).toEqual([
      ["alice", false],
      ["example-sync", true],
    ]);
  });

  it("marks an account the configuration lists as a bot", () => {
    const now = at("2026-09-22T12:00+02:00");
    const settings = {
      ...teamSettings,
      people: new Map([["dave", "bot" as const]]),
    };
    const [marked] = selectEvents(
      [event("2026-09-22T10:00+02:00")],
      day,
      now,
      settings,
    );
    expect(marked?.bot).toBe(true);
  });

  it("keeps an event dated at the current time and leaves out one dated after it", () => {
    const now = at("2026-09-22T12:00+02:00");
    const events = [
      event("2026-09-22T12:00+02:00"),
      event("2026-09-22T12:01+02:00"),
    ];
    expect(
      selectEvents(events, day, now, teamSettings).map(({ at }) => at),
    ).toEqual([now]);
  });

  it("keeps every kind of event, with the detail its activity line names", () => {
    const now = at("2026-09-22T12:00+02:00");
    const commented = event("2026-09-22T10:00+02:00");
    const events: ThreadEvent[] = [
      { ...commented, kind: "opened" },
      commented,
      { ...commented, kind: "reviewed" },
      { ...commented, kind: "reviewRequested" },
      { ...commented, kind: "pushed", commits: 2 },
      { ...commented, kind: "assigned", assignee: "bob" },
      { ...commented, kind: "labelled", label: "kind=bug" },
      { ...commented, kind: "closed" },
      { ...commented, kind: "merged" },
      { ...commented, kind: "reopened" },
    ];
    expect(selectEvents(events, day, now, teamSettings)).toEqual(
      events.map((kept) => ({ ...kept, bot: false })),
    );
  });
});
