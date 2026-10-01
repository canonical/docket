import { describe, expect, it, vi } from "vitest";
import useAddress, {
  type UseAddressProps,
} from "../../application/useAddress.js";
import { activityGroupings, listEvents } from "../../lib/activity/index.js";
import type { CacheStatus, RepoStage } from "../../lib/cache/index.js";
import type { WindowEvent } from "../../lib/events/index.js";
import { createProvider } from "../../lib/github/index.js";
import { listWaits, owedGroupings } from "../../lib/owed/index.js";
import type { Problem } from "../../lib/text/index.js";
import {
  CountsLine,
  StatusLine,
  ThreadRow,
} from "../../lib/ui/component/index.js";
import describeStage from "../../lib/ui/component/RefreshStages/describeStage.js";
import describeDetails from "../../lib/ui/component/StatusLine/describeDetails.js";
import describeStatus from "../../lib/ui/component/StatusLine/describeStatus.js";
import { minColumns, minLines } from "../../lib/ui/constants.js";
import { measureText } from "../../lib/ui/fit/index.js";
import { PaneHeader } from "../../lib/ui/subcomponent/index.js";
import type { Wait } from "../../lib/waits/index.js";
import { activityNow } from "../activity.js";
import { alice, teamSettings, thread } from "../facts.js";
import { longReview } from "../long.js";
import { recordedNow, recordedSettings } from "../recorded.js";
import { draftClose, overReview, soonReply } from "../rows.js";
import { ScreenFrame } from "../screen.js";
import { draw, drawSuspending } from "../terminal.js";

/** How `gh` answers when docket asks it for a token. */
const gh = vi.hoisted(() => ({
  failure: null as (Error & { code?: string; killed?: boolean }) | null,
}));

vi.mock("node:child_process", () => ({
  execFile: (...args: unknown[]) => {
    const answer = args.at(-1) as (failure: Error | null, out: string) => void;
    answer(gh.failure, "");
  },
}));

/** The problem setup shows when `gh` answers with `failure`. */
async function readSetupProblem(
  failure: Error & { code?: string; killed?: boolean },
): Promise<Problem> {
  gh.failure = failure;
  const refused = await createProvider("github.com", "0.0.0").catch(
    (error: Problem) => error,
  );
  const { code, message, recovery } = refused as Problem;
  return { code, message, recovery };
}

const now = new Date("2026-09-28T12:00:00Z");
const idle: CacheStatus = {
  syncedAt: new Date("2026-09-28T11:01:00Z"),
  refreshing: false,
  whole: false,
  stages: [],
  fullRefreshAvailableAt: undefined,
  paused: undefined,
  failure: undefined,
};
const until = new Date("2026-09-28T23:59:00Z");
const failure = (code: string) =>
  Object.assign(new Error("failed"), { code, recovery: "refresh" });
const names = { "example-org/example-repo": "example" };
const stage = (kind: RepoStage) => [
  { repo: "example-org/example-repo", stage: kind },
];

/** A full refresh with three digits of pages, too wide for the narrowest pane. */
const fullRefresh: CacheStatus = {
  ...idle,
  whole: true,
  refreshing: true,
  stages: stage({ kind: "reading", fetched: 999, total: 999 }),
};

/** Each message the status line gives in docket's own words, at its widest. */
const messages: readonly CacheStatus[] = [
  idle,
  { ...idle, paused: { reason: "rateLimit", until } },
  { ...idle, syncedAt: undefined, paused: { reason: "rateLimit", until } },
  { ...idle, paused: { reason: "budget", until } },
  { ...idle, failure: failure("GITHUB_TIMED_OUT") as never },
  { ...idle, failure: failure("GITHUB_REQUEST_FAILED") as never },
  { ...idle, failure: failure("GITHUB_RATE_LIMITED") as never },
  {
    ...idle,
    syncedAt: undefined,
    failure: failure("GITHUB_TIMED_OUT") as never,
  },
  { ...idle, fullRefreshAvailableAt: new Date("2026-09-28T12:09:59Z") },
  fullRefresh,
  { ...fullRefresh, whole: false },
];

describe("docket's own words at the narrowest pane", () => {
  it("holds each status message whole, a full refresh without its pages, and the details' count, which leaves whole where they would meet", () => {
    for (const status of messages) {
      for (const attention of ["active", "idle"] as const) {
        const message = describeStatus(
          status,
          now,
          "UTC",
          names,
          undefined,
          attention,
        );
        const right = describeDetails(status, message, attention, false, {
          read: 999,
          asked: 999,
        });
        // A message with a part that gives way keeps the words without it.
        const words = message?.shorter ?? message?.text ?? "";
        for (const text of [words, right]) {
          expect(measureText(text), text).toBeLessThanOrEqual(minColumns);
        }
      }
    }
  });

  it("draws a full refresh's words whole once its pages give way", async () => {
    const screen = await draw(
      <StatusLine
        status={fullRefresh}
        now={now}
        timezone="UTC"
        names={names}
        width={minColumns}
      />,
      minColumns,
    );
    expect(screen.lines.at(0)).toBe("full refresh · example 1/1");
  });

  it("holds each mode's header as the terminal builds it, every grouping and window, its sort leaving whole when it does not fit", async () => {
    const opened: UseAddressProps[] = [
      ...owedGroupings.map(
        (owedGrouping): UseAddressProps => ({
          mode: "owed",
          owedGrouping,
          windows: [{ amount: 24, unit: "h" }],
          stacks: true,
        }),
      ),
      ...activityGroupings.flatMap((grouping) =>
        (["h", "d", "w"] as const).map(
          (unit): UseAddressProps => ({
            mode: "activity",
            owedGrouping: "none",
            activity: { grouping, window: { amount: 999, unit } },
            windows: [{ amount: 999, unit }],
            stacks: true,
          }),
        ),
      ),
    ];
    /** The header the terminal draws for where it opens. */
    const Header = (props: UseAddressProps) => {
      const { header } = useAddress(props);
      return (
        <PaneHeader
          title={{ text: header.title, kind: "words" }}
          address={{ text: header.address, kind: "words" }}
          sort={{ text: header.sort, kind: "words" }}
          width={minColumns}
        />
      );
    };
    const lines: (string | undefined)[] = [];
    for (const props of opened) {
      const line = (await draw(<Header {...props} />, minColumns)).lines.at(0);
      lines.push(line);
      expect(line).toMatch(
        /^(owed|activity) +(one list|by \w+|\d+[hdw] · (one list|by \w+))( · (overdue|newest) first)?$/,
      );
    }
    expect(lines).toContain(`owed${" ".repeat(12)}one list · overdue first`);
  });

  it("holds the counts owed and activity build, with three digits in every state and in the position, leaving parts out whole", async () => {
    const many = (wait: Wait) => Array.from({ length: 999 }, () => wait);
    const owed = listWaits(
      [
        {
          repo: { name: "example", repo: "example-org/example-repo", tags: [] },
          time: teamSettings.time,
          people: teamSettings.people,
          yours: [],
          waits: [
            ...many(overReview.wait),
            ...many(soonReply.wait),
            ...many(draftClose.wait),
          ],
        },
      ],
      recordedNow,
    ).summary;
    const activity = listEvents(
      [
        {
          repo: { name: "example", repo: "example-org/example-repo", tags: [] },
          people: teamSettings.people,
          threads: [],
          events: Array.from(
            { length: 999 },
            (_, number): WindowEvent => ({
              thread: thread({ number }),
              kind: "pushed",
              commits: 1,
              actor: alice,
              at: activityNow,
              bot: false,
            }),
          ),
        },
      ],
      activityNow,
    ).summary;
    const lines: (string | undefined)[] = [];
    for (const [summary, place] of [
      [owed, "999/999/999"],
      [activity, "999/999"],
    ] as const) {
      const screen = await draw(
        <CountsLine
          summary={summary}
          position={{ text: place, kind: "figure" }}
          width={minColumns}
        />,
        minColumns,
      );
      lines.push(screen.lines.at(0));
    }
    expect(lines).toEqual([
      `999 over · 999 soon${" ".repeat(10)}999/999/999`,
      `999 threads · 999 events${" ".repeat(9)}999/999`,
    ]);
    expect(owed.fields.map(({ text }) => text)).toEqual([
      "999 over",
      "999 soon",
      "999 on track",
    ]);
    expect(activity.fields.map(({ text }) => text)).toEqual([
      "999 threads",
      "999 events",
    ]);
  });

  it("holds each first-run stage in the 20 cells its column keeps", () => {
    const stages: readonly RepoStage[] = [
      { kind: "waiting" },
      { kind: "checking" },
      { kind: "reading", fetched: 99, total: 99 },
      { kind: "checks", fetched: 99, total: 99 },
      { kind: "done", threads: 9999, fetched: 99, total: 99 },
      { kind: "paused", reason: "budget" },
      { kind: "paused", reason: "rateLimit" },
    ];
    for (const each of stages) {
      const text = describeStage(each)
        .map((piece) => piece.text)
        .join("");
      expect(measureText(text), text).toBeLessThanOrEqual(20);
    }
  });

  it("holds a row's kinds and distance whole beside the longest reference", async () => {
    const screen = await draw(
      <ThreadRow row={longReview} width={minColumns} />,
      minColumns,
    );
    expect(screen.lines.at(0)).toMatch(/ PR review 1d over$/);
  });

  it("holds every notice setup shows whole on the smallest pane, its recovery included", async () => {
    const problems = await Promise.all([
      readSetupProblem(Object.assign(new Error("gh"), { code: "ENOENT" })),
      readSetupProblem(Object.assign(new Error("gh"), { killed: true })),
      readSetupProblem(new Error("gh")),
    ]);
    for (const problem of problems) {
      const screen = await drawSuspending(
        <ScreenFrame
          mode="owed"
          owedGrouping="none"
          now={() => recordedNow}
          openInBrowser={async () => {}}
          settings={recordedSettings}
          watched={[]}
          source={{ problem }}
        />,
        minColumns,
        minLines,
      );
      const shown = screen.lines.join(" ").replace(/ +/g, " ");
      expect(shown).toContain(problem.message.replace(/\.$/, ""));
      expect(shown).toContain(`Recovery: ${problem.recovery}`);
    }
  });
});
