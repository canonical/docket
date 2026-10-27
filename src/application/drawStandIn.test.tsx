import { describe, expect, it } from "vitest";
import { describeNoTeam } from "../lib/owed/index.js";
import type { ProviderError } from "../lib/provider/index.js";
import { tokens } from "../lib/tokens/index.js";
import { settleStatus } from "../testing/cache.js";
import { providerError } from "../testing/provider.js";
import {
  recordedActivity,
  recordedNow,
  recordedRepos,
} from "../testing/recorded.js";
import { draw, hex } from "../testing/terminal.js";
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
  windowed: undefined,
  watched: recordedRepos,
  width: 40,
};

/** Draws what stands in for `props`, which must be something. */
async function drawFor(props: Partial<StandInProps>, height = 6) {
  const node = drawStandIn({ ...listing, ...props });
  expect(node).toBeDefined();
  return draw(node, 40, height);
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

  it("says the first run is in progress, with no progress line, while no page count is known", async () => {
    const screen = await drawFor({ held: false, status: undefined });
    expect(screen.lines.slice(0, 2)).toEqual(["  refresh in progress…", ""]);
    expect(screen.look("refresh in progress")?.fg).toBe(
      hex(tokens["color.text"]),
    );
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
      "  example reading page 6/9",
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

  it("gives a failure that came before any fetch its own reason and step, not an earlier run's failed line", async () => {
    const refused: ProviderError = Object.assign(
      new Error("GitHub refused the request."),
      { code: "GITHUB_REQUEST_FAILED", recovery: "check gh's access" } as const,
    );
    const screen = await drawFor({
      held: false,
      status: {
        ...settleStatus(recordedNow),
        syncedAt: undefined,
        failure: refused,
        stages: [
          {
            repo: "example-org/example-repo",
            stage: { kind: "failed", error: providerError("GITHUB_TIMED_OUT") },
          },
        ],
      },
    });
    expect(screen.lines.slice(0, 3)).toEqual([
      "  ✗ GitHub refused the request",
      "  Recovery: check gh's access",
      "",
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
    // The notice keeps all its lines, so the room holds them both.
    const screen = await drawFor(
      { nothingOwed: true, teamless: describeNoTeam([new Map()]) },
      12,
    );
    expect(screen.lines.at(0)).toMatch(/^ {2}✗ no team in docket\.yaml/);
    expect(screen.lines).toContain("  nothing owed");
  });

  it("names why activity's events could not be read, without its full stop", async () => {
    const screen = await drawFor({
      mode: "activity",
      owedListed: false,
      windowed: {
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
    expect(screen.look("refresh in progress")?.fg).toBe(
      hex(tokens["color.text"]),
    );
  });

  it("stands in for nothing while owed's list is drawn, whatever activity holds", () => {
    const activity = {
      problem: {
        code: "UNEXPECTED_FAILURE" as const,
        message: "docket failed.",
        recovery: "report it",
      },
    };
    expect(drawStandIn({ ...listing, windowed: activity })).toBeUndefined();
  });

  it("stands in for nothing while activity's list is held", () => {
    const activity = { list: recordedActivity("kind") };
    expect(
      drawStandIn({
        ...listing,
        mode: "activity",
        owedListed: false,
        windowed: activity,
      }),
    ).toBeUndefined();
  });

  it("says finished's window holds no thread once it is read", async () => {
    const screen = await drawFor({
      mode: "finished",
      owedListed: false,
      windowed: { list: undefined },
      emptyWindow: { text: "nothing merged or closed in 24h", kind: "words" },
    });
    expect(screen.lines.at(0)).toBe("  nothing merged or closed in 24h");
  });

  it("says finished's window is being read while no list is held for it", async () => {
    const screen = await drawFor({ mode: "finished", owedListed: false });
    expect(screen.lines.at(0)).toBe("  refresh in progress…");
  });
});
