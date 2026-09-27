/**
 * A fixed recording of two watched repositories, the instant it is read
 * at, and the lists built from it, for the text interface's saved
 * outputs. It imports nothing from vitest.
 */
import {
  type ActivityGrouping,
  groupEvents,
  listEvents,
} from "../lib/activity/index.js";
import type { Repo, Settings } from "../lib/config/index.js";
import { selectEvents, type ThreadEvent } from "../lib/events/index.js";
import { groupWaits, listWaits, type OwedGrouping } from "../lib/owed/index.js";
import { findWaits, type Thread } from "../lib/waits/index.js";
import {
  alice,
  at,
  bob,
  carol,
  dave,
  exampleSync,
  teamSettings,
} from "./facts.js";

/** Monday 28 September 2026, 12:00 in Paris. */
export const recordedNow = at("2026-09-28T12:00+02:00");

/** The two watched repositories, in the configuration's order. */
export const recordedRepos: readonly Repo[] = [
  { name: "example", repo: "example-org/example-repo", tags: ["core"] },
  { name: "docs", repo: "example-org/example-docs", tags: [] },
];

/** Settings with alice and bob on the team, in Paris, watching both. */
export const recordedSettings: Settings = {
  ...teamSettings,
  repos: recordedRepos,
};

/**
 * A pull request dave opened, assigned to alice, with bob asked for a
 * review, failing checks, second in a stack of three, and dave's comment
 * unanswered.
 */
export const parserFix: Thread = {
  repo: "example-org/example-repo",
  number: 12,
  kind: "pullRequest",
  title: "Fix the parser",
  stack: { number: 3, position: 2, size: 3, base: "main" },
  author: dave,
  createdAt: at("2026-09-21T10:00+02:00"),
  open: true,
  draft: false,
  labels: ["kind=bug"],
  assignees: [alice],
  comments: [{ author: dave, at: at("2026-09-25T09:00+02:00") }],
  reviews: [],
  reviewRequests: [{ reviewer: bob, at: at("2026-09-28T09:00+02:00") }],
  pushes: [],
  checks: "failing",
};

/** An issue carol opened on Friday, unassigned. */
export const crash: Thread = {
  repo: "example-org/example-repo",
  number: 15,
  kind: "issue",
  title: "Crash on start",
  author: carol,
  createdAt: at("2026-09-25T16:00+02:00"),
  open: true,
  draft: false,
  labels: [],
  assignees: [],
  comments: [],
  reviews: [],
  reviewRequests: [],
  pushes: [],
};

/** A documentation issue alice opened, assigned to alice and bob. */
export const tokensGuide: Thread = {
  repo: "example-org/example-docs",
  number: 4,
  kind: "issue",
  title: "Where do tokens live?",
  author: alice,
  createdAt: at("2026-09-01T10:00+02:00"),
  open: true,
  draft: false,
  labels: [],
  assignees: [alice, bob],
  comments: [],
  reviews: [],
  reviewRequests: [],
  pushes: [],
};

/** Every open thread of the recording. */
export const recordedThreads: readonly Thread[] = [
  parserFix,
  crash,
  tokensGuide,
];

/** What happened on the threads over the last days. */
export const recordedEvents: readonly ThreadEvent[] = [
  {
    kind: "commented",
    thread: parserFix,
    actor: dave,
    at: at("2026-09-25T09:00+02:00"),
  },
  {
    kind: "reviewRequested",
    thread: parserFix,
    actor: alice,
    at: at("2026-09-28T09:00+02:00"),
  },
  {
    kind: "checksFailed",
    thread: parserFix,
    actor: exampleSync,
    checks: ["lint"],
    at: at("2026-09-28T11:35+02:00"),
  },
  {
    kind: "labelled",
    thread: tokensGuide,
    actor: exampleSync,
    label: "kind=docs",
    at: at("2026-09-27T20:00+02:00"),
  },
];

/** owed, as the recording gives it at `recordedNow`. */
export function recordedOwed(grouping: OwedGrouping = "none") {
  const list = listWaits(
    recordedRepos.map((repo) => ({
      repo,
      time: recordedSettings.time,
      waits: recordedThreads
        .filter((thread) => thread.repo === repo.repo)
        .flatMap((thread) => findWaits(thread, recordedSettings)),
    })),
    recordedNow,
  );
  return groupWaits(list, { mode: "owed", grouping }, recordedRepos);
}

/** activity over 72 working hours, as the recording gives it. */
export function recordedActivity(grouping: ActivityGrouping = "kind") {
  const window = { amount: 72, unit: "h" } as const;
  const list = listEvents(
    recordedRepos.map((repo) => ({
      repo,
      people: recordedSettings.people,
      threads: recordedThreads.filter((thread) => thread.repo === repo.repo),
      events: selectEvents(
        recordedEvents.filter(({ thread }) => thread.repo === repo.repo),
        window,
        recordedNow,
        recordedSettings,
      ),
    })),
    recordedNow,
  );
  return groupEvents(
    list,
    { mode: "activity", window, grouping },
    recordedRepos,
  );
}
