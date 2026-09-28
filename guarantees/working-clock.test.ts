import { afterAll, describe, expect, it } from "vitest";
import makeHome from "./makeHome.js";

/**
 * Working time counts the configured workdays whole, in the configured
 * time zone, and nothing else: a weekend adds no time, a day the clocks
 * change is as long as the clock says, and the machine's own time zone
 * changes nothing. Read from outside, through when `owed` says each
 * 24-hour reply falls due.
 */
const personalFile = (timezone: string) => `version: 1
repos:
  example: { repo: example-org/example-repo }
time:
  timezone: ${timezone}
targets:
  next-move:
    response: 24h
`;

const now = "2027-03-15T12:00:00Z";
const homes = {
  paris: makeHome(personalFile("Europe/Paris")),
  newYork: makeHome(personalFile("America/New_York")),
};
afterAll(() => {
  for (const home of Object.values(homes)) home.remove();
});

interface Wait {
  readonly reference: string;
  readonly kind: string;
  readonly due: string;
}

/** When each issue's reply falls due, by issue, as `owed` gives it. */
const findReplyDue = async (
  home: (typeof homes)[keyof typeof homes],
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
      .map(({ reference, due }) => [reference, due]),
  );
};

// Each call is made once, and every assertion about it reads the same
// answer.
const answers = new Map<string, ReturnType<typeof findReplyDue>>();
const readReplyDue = (city: keyof typeof homes, machineZone = "UTC") => {
  const key = `${city} ${machineZone}`;
  const known = answers.get(key);
  if (known) return known;
  const answer = findReplyDue(homes[city], machineZone);
  answers.set(key, answer);
  return answer;
};

describe("working-clock", () => {
  it("carries a reply asked on Friday at 16:00 over the weekend to Monday at 16:00", async () => {
    const due = await readReplyDue("paris");
    expect(due["example#1"]).toBe("2026-09-28T14:00:00.000Z");
  });

  it("keeps Monday at 16:00 when the clocks go back over the weekend", async () => {
    const due = await readReplyDue("paris");
    expect(due["example#2"]).toBe("2026-10-26T15:00:00.000Z");
  });

  it("keeps Monday at 16:00 when the clocks go forward over the weekend", async () => {
    const due = await readReplyDue("newYork");
    expect(due["example#3"]).toBe("2027-03-15T20:00:00.000Z");
  });

  it("starts a reply asked on a local Saturday at the start of Monday", async () => {
    const due = await readReplyDue("paris");
    expect(due["example#4"]).toBe("2026-09-28T22:00:00.000Z");
  });

  it("counts the same instant in the configured time zone, where it is still Friday", async () => {
    const due = await readReplyDue("newYork");
    expect(due["example#4"]).toBe("2026-09-29T02:00:00.000Z");
  });

  it("gives the same answer whatever time zone the machine is in", async () => {
    const zones = ["UTC", "Pacific/Kiritimati", "America/Los_Angeles"];
    const answers = [];
    for (const zone of zones) answers.push(await readReplyDue("paris", zone));
    expect(answers.at(1)).toEqual(answers.at(0));
    expect(answers.at(2)).toEqual(answers.at(0));
  });
});
