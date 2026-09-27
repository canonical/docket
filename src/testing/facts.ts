import type { Account } from "../lib/people/index.js";

/** A member of the organisation, listed as team in `people`. */
export const alice: Account = { login: "alice", type: "user", member: true };

/** A second team member. */
export const bob: Account = { login: "bob", type: "user", member: true };

/** A member of the organisation outside the team. */
export const carol: Account = { login: "carol", type: "user", member: true };

/** Someone from outside the organisation. */
export const dave: Account = { login: "dave", type: "user", member: false };

/** Automation, recognised by its account type alone. */
export const exampleSync: Account = {
  login: "example-sync",
  type: "bot",
  member: false,
};
