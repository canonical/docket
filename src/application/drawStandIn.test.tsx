import { describe, expect, it } from "vitest";
import { describeNoTeam } from "../lib/owed/index.js";
import { tokens } from "../lib/tokens/index.js";
import { settleStatus } from "../testing/cache.js";
import { recordedActivity, recordedNow } from "../testing/recorded.js";
import { draw } from "../testing/terminal.js";
import drawStandIn, { type StandInProps } from "./drawStandIn.js";

/** owed with its threads in and its list drawn: nothing stands in. */
const listing: StandInProps = {
  mode: "owed",
  problem: undefined,
  refused: undefined,
  held: true,
  status: settleStatus(recordedNow),
  timezone: "Europe/Paris",
  nothingOwed: false,
  teamless: undefined,
  owedListed: true,
  activity: undefined,
  width: 40,
};

/** Draws what stands in for `props`, which must be something. */
async function drawFor(props: Partial<StandInProps>) {
  const node = drawStandIn({ ...listing, ...props });
  expect(node).toBeDefined();
  return draw(node, 40, 6);
}

describe("drawStandIn", () => {
  it("names the problem that keeps the screen from listing anything, before everything else, without its full stop", async () => {
    const screen = await drawFor({
      problem: {
        code: "GH_NOT_INSTALLED",
        message: "gh is not installed.",
        recovery: "install gh",
      },
      held: false,
      nothingOwed: true,
    });
    expect(screen.lines.slice(0, 2)).toEqual([
      "  ✗ gh is not installed",
      "  Recovery: install gh",
    ]);
  });

  it("gives the refusal it is handed, before the first data's progress", () => {
    const refused = <text>refused</text>;
    expect(drawStandIn({ ...listing, refused, held: false })).toBe(refused);
  });

  it("shows the first run's progress while nothing is fetched yet", async () => {
    const screen = await drawFor({ held: false, status: undefined });
    expect(screen.lines.slice(0, 2)).toEqual([
      "  refresh in progress…",
      `  ${"░".repeat(29)} 0/0`,
    ]);
    expect(screen.look("refresh in progress")?.fg).toBe(tokens["color.text"]);
  });

  it("shows how many pages the first run fetched", async () => {
    const screen = await drawFor({
      held: false,
      status: {
        ...settleStatus(recordedNow),
        refreshing: true,
        fullRefresh: {
          repo: "example-org/example-repo",
          position: 1,
          count: 2,
          fetched: 5,
          total: 9,
        },
      },
    });
    expect(screen.lines.slice(0, 2)).toEqual([
      "  refresh in progress…",
      `  ${"█".repeat(16)}${"░".repeat(13)} 5/9`,
    ]);
  });

  it("says when docket resumes while the first fetch is held", async () => {
    const screen = await drawFor({
      held: false,
      status: {
        ...settleStatus(recordedNow),
        paused: {
          until: new Date("2026-01-01T12:00:00Z"),
          reason: "rateLimit",
        },
      },
    });
    expect(screen.lines.slice(0, 4)).toEqual([
      "  ✗ GitHub refused requests for its rate",
      "  limit",
      "  Recovery: wait: docket resumes at",
      "  13:00",
    ]);
  });

  it("says nothing is owed", async () => {
    const screen = await drawFor({ nothingOwed: true });
    expect(screen.lines.at(0)).toBe("  nothing owed");
  });

  it("keeps the notice above nothing owed while no team is listed", async () => {
    const screen = await drawFor({
      nothingOwed: true,
      teamless: describeNoTeam([new Map()]),
    });
    expect(screen.lines.at(0)).toMatch(/^ {2}✗ no team in docket\.yaml/);
    expect(screen.lines).toContain("  nothing owed");
  });

  it("names why activity's events could not be read, without its full stop", async () => {
    const screen = await drawFor({
      mode: "activity",
      owedListed: false,
      activity: {
        problem: {
          code: "UNEXPECTED_FAILURE",
          message: "docket failed.",
          recovery: "report it",
        },
      },
    });
    expect(screen.lines.slice(0, 2)).toEqual([
      "  ✗ docket failed",
      "  Recovery: report it",
    ]);
  });

  it("says activity's events are being read while no list is held for the window", async () => {
    const screen = await drawFor({ mode: "activity", owedListed: false });
    expect(screen.lines.at(0)).toBe("  refresh in progress…");
    expect(screen.look("refresh in progress")?.fg).toBe(tokens["color.text"]);
  });

  it("stands in for nothing while owed's list is drawn, whatever activity holds", () => {
    const activity = {
      problem: {
        code: "UNEXPECTED_FAILURE" as const,
        message: "docket failed.",
        recovery: "report it",
      },
    };
    expect(drawStandIn({ ...listing, activity })).toBeUndefined();
  });

  it("stands in for nothing while activity's list is held", () => {
    const activity = { list: recordedActivity("kind") };
    expect(
      drawStandIn({
        ...listing,
        mode: "activity",
        owedListed: false,
        activity,
      }),
    ).toBeUndefined();
  });
});
