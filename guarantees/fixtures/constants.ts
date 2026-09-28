import type { RecordedAnswer } from "../types.js";

/** The answer to a request for a repository's own file: there is none. */
export const noFile: RecordedAnswer = {
  data: { repository: { object: null } },
};

/** The repository activity feed, holding no push. */
export const noPushes: RecordedAnswer = { body: [] };

/** The account gh is signed in with. */
export const viewer: RecordedAnswer = { data: { viewer: { login: "alice" } } };
