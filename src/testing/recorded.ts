/**
 * A fixed recording of two watched repositories, the instant it is read
 * at, and the lists built from it, for the text interface's saved
 * outputs. It imports nothing from vitest.
 */

import type { Watched } from "../application/types.js";
import {
  type ActivityGrouping,
  groupEvents,
  listEvents,
} from "../lib/activity/index.js";
import {
  parseFile,
  type Repo,
  type Resolved,
  resolveSettings,
  type Settings,
} from "../lib/config/index.js";
import { type ThreadEvent, timeEvents } from "../lib/events/index.js";
import { groupWaits, listWaits, type OwedGrouping } from "../lib/owed/index.js";
import type { Provider, ThreadDetail } from "../lib/provider/index.js";
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
import { personalFile } from "./fixtures.js";
import { fakeProvider } from "./provider.js";

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
  url: "https://github.com/example-org/example-repo/pull/12",
  kind: "pullRequest",
  title: "Fix the parser",
  stack: { number: 3, position: 2, size: 3, base: "main" },
  author: dave,
  createdAt: at("2026-09-21T10:00+02:00"),
  updatedAt: at("2026-09-28T11:35+02:00"),
  open: true,
  draft: false,
  labels: ["kind=bug"],
  assignees: [alice],
  comments: [
    {
      author: dave,
      at: at("2026-09-25T09:00+02:00"),
      text: "Rebased on main.\n\nCould someone look again?",
    },
  ],
  reviews: [],
  reviewRequests: [
    { reviewer: bob, requester: alice, at: at("2026-09-28T09:00+02:00") },
  ],
  pushes: [],
  checks: "failing",
};

/** An issue carol opened on Friday, unassigned. */
export const crash: Thread = {
  repo: "example-org/example-repo",
  number: 15,
  url: "https://github.com/example-org/example-repo/issues/15",
  kind: "issue",
  title: "Crash on start",
  author: carol,
  createdAt: at("2026-09-25T16:00+02:00"),
  updatedAt: at("2026-09-25T16:00+02:00"),
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
  url: "https://github.com/example-org/example-docs/issues/4",
  kind: "issue",
  title: "Where do tokens live?",
  author: alice,
  createdAt: at("2026-09-01T10:00+02:00"),
  updatedAt: at("2026-09-01T10:00+02:00"),
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

/** Everything the details of the pull request show. */
export const parserFixDetail: ThreadDetail = {
  createdAt: at("2026-09-21T10:00+02:00"),
  updatedAt: at("2026-09-28T11:35+02:00"),
  labels: ["kind=bug"],
  assignees: [alice],
  messages: [
    {
      author: bob,
      at: at("2026-09-24T15:00+02:00"),
      body: "Looks close.",
    },
    {
      author: dave,
      at: at("2026-09-25T09:00+02:00"),
      body: "Rebased on main.\n\nCould someone look again?",
    },
  ],
  requests: [
    { reviewer: bob, requester: alice, at: at("2026-09-28T09:00+02:00") },
  ],
  files: [
    { path: "src/parser.ts", additions: 40, deletions: 12 },
    { path: "src/parser.test.ts", additions: 25, deletions: 0 },
  ],
  checks: [
    { name: "lint", state: "failing" },
    { name: "test", state: "passing" },
  ],
  stack: [
    { position: 1, number: 11, state: "merged" },
    { position: 2, number: 12, state: "open" },
    { position: 3, number: 13, state: "open" },
  ],
};

/**
 * A provider answering from the recording: the threads of each
 * repository, their events, the pull request's details, assignees, everyone
 * assignable and review candidates, writes that GitHub records whole, and alice as the account
 * gh is signed in with. `overrides` replaces any operation.
 */
export function recordedProvider(overrides: Partial<Provider> = {}): Provider {
  return fakeProvider({
    snapshot: async (repo) => ({
      threads: recordedThreads.filter((thread) => thread.repo === repo),
      cursor: { since: "2026-09-28T09:59:00Z" },
    }),
    events: async (repo) =>
      recordedEvents.filter(({ thread }) => thread.repo === repo),
    threadDetail: async () => parserFixDetail,
    threadDetails: async (threads) => threads.map(() => parserFixDetail),
    assignableUsers: async () => [alice, bob, carol, dave],
    reviewCandidates: async () => ({
      requested: [bob],
      suggested: [carol],
      people: [alice, bob, carol],
      teams: [{ team: "example-org/reviewers" }],
    }),
    readAssignees: async ({ repo, number }) =>
      recordedThreads.find(
        (thread) => thread.repo === repo && thread.number === number,
      )?.assignees ?? [],
    setAssignees: async (_thread, logins) =>
      logins.map((login) => ({ login, type: "user" as const })),
    setReviewers: async (_pull, reviewers) => reviewers,
    viewer: async () => "alice",
    ...overrides,
  });
}

/** owed, as the recording gives it at `recordedNow`. */
export function recordedOwed(grouping: OwedGrouping = "none") {
  const list = listWaits(
    recordedRepos.map((repo) => ({
      repo,
      time: recordedSettings.time,
      people: recordedSettings.people,
      yours: recordedSettings.you.teams,
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
      yours: recordedSettings.you.teams,
      threads: recordedThreads.filter((thread) => thread.repo === repo.repo),
      events: timeEvents(
        recordedEvents.filter(({ thread }) => thread.repo === repo.repo),
        window,
        recordedSettings,
      )
        .filter(({ until }) => until >= recordedNow)
        .map(({ event }) => event),
    })),
    recordedNow,
  );
  return groupEvents(
    list,
    { mode: "activity", window, grouping },
    recordedRepos,
  );
}

/**
 * The recording's repositories, each with `settings` in effect, and the
 * errors of its own file: none, unless `repositoryErrors` names some.
 */
export function recordedWatched(
  settings: Settings = recordedSettings,
  repositoryErrors: Resolved["repositoryErrors"] = [],
): Watched[] {
  const origins = resolveSettings(undefined, undefined).origins;
  return settings.repos.map((repo) => ({
    ...repo,
    resolved: { settings, origins, repositoryErrors },
  }));
}

/**
 * The settings `personalFile` resolves to with no repository file, or,
 * without it, the built-in defaults.
 */
export function resolvedPersonal(withFile = true): Resolved {
  if (!withFile) return resolveSettings(undefined, undefined);
  const outcome = parseFile(personalFile, "personal");
  if (!outcome.ok) throw new Error("the personal file fixture is valid");
  return resolveSettings(outcome.layer, undefined);
}
