import { afterAll, describe, expect, it } from "vitest";
import makeHome from "./makeHome.js";

/**
 * Working time counts the configured workdays whole, in the configured
 * time zone, and nothing else: a weekend adds no time, a day the clocks
 * change is as long as the clock says, and the machine's own time zone
 * changes nothing. Read from outside, through what `owed` says of each
 * 24-hour reply: when it falls due, and, at instants chosen on a weekend,
 * across midnight in the configured time zone and after the clocks go
 * back, whether it is on track or over, and by how much.
 */
const buildPersonalFile = (timezone: string) => `version: 1
repos:
  example: { repo: example-org/example-repo }
time:
  timezone: ${timezone}
targets:
  next-move:
    response: 24h
`;

// When a reply falls due does not depend on the instant it is read at.
const anyInstant = "2027-03-15T12:00:00Z";
// Monday 01:00 in Paris, while it is still Sunday in UTC.
const parisMondayNight = "2026-09-27T23:00:00Z";
// Saturday 12:00 in Paris.
const parisSaturday = "2026-09-26T10:00:00Z";
// Monday 10:00 in Paris, after the clocks went back over the weekend.
const parisMondayAfterChange = "2026-10-26T09:00:00Z";

const homes = {
  paris: makeHome(buildPersonalFile("Europe/Paris")),
  newYork: makeHome(buildPersonalFile("America/New_York")),
};
afterAll(() => {
  for (const home of Object.values(homes)) home.remove();
});

interface Wait {
  readonly reference: string;
  readonly kind: string;
  readonly state: string;
  readonly overdue: number;
  readonly target: string;
  readonly due: string;
}

/** Each issue's reply as `owed` gives it at `now`, by issue. */
const findReplies = async (
  home: (typeof homes)[keyof typeof homes],
  now: string,
  machineZone: string,
) => {
  const { code, out, err } = await home.call(["owed", "--format", "json"], {
    now,
    recording: "clock",
    machineZone,
  });
  expect({ code, err }).toEqual({ code: 0, err: "" });
  const { groups } = JSON.parse(out) as {
    groups: { waits: Wait[] }[];
  };
  return Object.fromEntries(
    groups
      .flatMap(({ waits }) => waits)
      .filter(({ kind }) => kind === "response")
      // `overdue` is a share of the target, which is given in working
      // hours: their product is the working time past due, below zero
      // while time is left.
      .map(({ reference, state, overdue, target, due }) => [
        reference,
        { state, hoursOver: overdue * Number.parseFloat(target), due },
      ]),
  );
};

// Each call is made once, and every assertion about it reads the same
// answer.
const answers = new Map<string, ReturnType<typeof findReplies>>();
const readReplies = (
  city: keyof typeof homes,
  now = anyInstant,
  machineZone = "UTC",
) => {
  const key = `${city} ${now} ${machineZone}`;
  const known = answers.get(key);
  if (known) return known;
  const answer = findReplies(homes[city], now, machineZone);
  answers.set(key, answer);
  return answer;
};

describe("working-clock", () => {
  it("carries a reply asked on Friday at 16:00 over the weekend to Monday at 16:00", async () => {
    const replies = await readReplies("paris");
    expect(replies["example#1"]?.due).toBe("2026-09-28T14:00:00.000Z");
  });

  it("keeps Monday at 16:00 when the clocks go back over the weekend", async () => {
    const replies = await readReplies("paris");
    expect(replies["example#2"]?.due).toBe("2026-10-26T15:00:00.000Z");
  });

  it("keeps Monday at 16:00 when the clocks go forward over the weekend", async () => {
    const replies = await readReplies("newYork");
    expect(replies["example#3"]?.due).toBe("2027-03-15T20:00:00.000Z");
  });

  it("starts a reply asked on a local Saturday at the start of Monday", async () => {
    const replies = await readReplies("paris");
    expect(replies["example#4"]?.due).toBe("2026-09-28T22:00:00.000Z");
  });

  it("counts the same instant in the configured time zone, where it is still Friday", async () => {
    const replies = await readReplies("newYork");
    expect(replies["example#4"]?.due).toBe("2026-09-29T02:00:00.000Z");
  });

  it("leaves 15 hours at 01:00 on Monday in the configured time zone, while it is still Sunday in UTC", async () => {
    const replies = await readReplies("paris", parisMondayNight);
    expect(replies["example#1"]).toMatchObject({
      state: "onTrack",
      hoursOver: expect.closeTo(-15),
    });
  });

  it("counts none of the weekend in what is left", async () => {
    const replies = await readReplies("paris", parisSaturday);
    expect(replies["example#1"]).toMatchObject({
      state: "onTrack",
      hoursOver: expect.closeTo(-16),
    });
  });

  it("leaves 6 hours at 10:00 on the Monday after the clocks go back", async () => {
    const replies = await readReplies("paris", parisMondayAfterChange);
    expect(replies["example#2"]).toMatchObject({
      state: "onTrack",
      hoursOver: expect.closeTo(-6),
    });
  });

  it("counts how far a reply is over in working days", async () => {
    const replies = await readReplies("paris", parisMondayAfterChange);
    expect(replies["example#1"]).toMatchObject({
      state: "over",
      // 19 working days of 24 hours, and 18 hours of the 20th.
      hoursOver: expect.closeTo(474),
    });
  });

  it("gives the same answer whatever time zone the machine is in", async () => {
    const zones = ["UTC", "Pacific/Kiritimati", "America/Los_Angeles"];
    const answers = [];
    for (const zone of zones) {
      answers.push(await readReplies("paris", parisMondayNight, zone));
    }
    expect(answers.at(1)).toEqual(answers.at(0));
    expect(answers.at(2)).toEqual(answers.at(0));
  });
});
