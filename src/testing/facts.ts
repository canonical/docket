import {
  builtInSettings,
  type Group,
  type Settings,
} from "../lib/config/index.js";
import type { Author } from "../lib/people/index.js";
import type { Thread } from "../lib/waits/index.js";

/** A member of the organisation, listed as team in `people`. */
export const alice: Author = { login: "alice", type: "user", member: true };

/** A second team member. */
export const bob: Author = { login: "bob", type: "user", member: true };

/** A member of the organisation outside the team. */
export const carol: Author = { login: "carol", type: "user", member: true };

/** Someone from outside the organisation. */
export const dave: Author = { login: "dave", type: "user", member: false };

/** Automation, recognised by its account type alone. */
export const exampleSync: Author = {
  login: "example-sync",
  type: "bot",
  member: false,
};

/** Settings with alice and bob on the team, on a Monday-to-Friday clock in Paris. */
export const teamSettings: Settings = {
  ...builtInSettings,
  people: new Map<string, Group>([
    ["alice", "team"],
    ["bob", "team"],
  ]),
  time: {
    workdays: ["mon", "tue", "wed", "thu", "fri"],
    timezone: "Europe/Paris",
  },
};

/** An instant written in ISO 8601, such as `2026-09-22T10:00+02:00`. */
export const at = (iso: string): Date => new Date(iso);

/**
 * An open issue in example-org/example-repo, opened by dave on Tuesday
 * 22 September 2026 at 10:00 in Paris, with nothing else recorded on it.
 */
export function thread(facts: Partial<Thread> = {}): Thread {
  return {
    repo: "example-org/example-repo",
    number: 1,
    kind: "issue",
    title: "Example thread",
    author: dave,
    createdAt: at("2026-09-22T10:00+02:00"),
    open: true,
    draft: false,
    labels: [],
    assignees: [],
    comments: [],
    reviews: [],
    reviewRequests: [],
    pushes: [],
    ...facts,
  };
}
