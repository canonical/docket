import { describe, expect, it } from "vitest";
import { describeNoTeam } from "../lib/owed/index.js";
import { tokens } from "../lib/tokens/index.js";
import { settleStatus } from "../testing/cache.js";
import {
  recordedActivity,
  recordedNow,
  recordedRepos,
} from "../testing/recorded.js";
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
  watched: recordedRepos,
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
      `  ${"░".repeat(28)} 0/0 pages`,
    ]);
    expect(screen.look("refresh in progress")?.fg).toBe(tokens["color.text"]);
  });

  it("shows each repository's stage and the pages the first run read", async () => {
    const screen = await drawFor({
      held: false,
      status: {
        ...settleStatus(recordedNow),
        refreshing: true,
        whole: true,
        stages: [
          {
            repo: "example-org/example-repo",
            stage: { kind: "reading", fetched: 5, total: 9 },
          },
          { repo: "example-org/example-docs", stage: { kind: "waiting" } },
        ],
      },
    });
    expect(screen.lines.slice(0, 4)).toEqual([
      "  refresh in progress…",
      "  example reading page 5/9",
      "  docs    waiting",
      `  ${"█".repeat(15)}${"░".repeat(13)} 5/9 pages`,
    ]);
  });

  it("shows the repositories a rate limit paused rather than why the first fetch waits, once each has a stage", async () => {
    const screen = await drawFor({
      held: false,
      status: {
        ...settleStatus(recordedNow),
        paused: {
          until: new Date("2026-01-01T12:00:00Z"),
          reason: "rateLimit",
        },
        stages: [
          {
            repo: "example-org/example-repo",
            stage: { kind: "paused", reason: "rateLimit" },
          },
        ],
      },
    });
    expect(screen.lines.slice(0, 2)).toEqual([
      "  refresh in progress…",
      "  example paused: rate limit",
    ]);
  });

  it("says when docket resumes while the first fetch is held and no repository has a stage", async () => {
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
