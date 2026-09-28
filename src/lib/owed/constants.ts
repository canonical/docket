import type { WaitKind } from "../waits/index.js";
import type { OwedGrouping } from "./types.js";

/** The groupings, in the order the reader steps through them; the first is the default. */
export const owedGroupings: readonly OwedGrouping[] = [
  "none",
  "owner",
  "repo",
  "stack",
];

/**
 * A wait is due soon once less than a fifth of its target is left, so a
 * short target and a long one warn at the same point in their life. A
 * fifth keeps a 30-day close with 6 days left on track, while a 2-day
 * review with 9 hours left is due soon.
 */
export const soonShare = 0.2;

/**
 * The mark on every row of a repository whose own file is invalid: the
 * repository then has the built-in settings, whatever its file says.
 */
export const invalidFileMark = "invalid repository file";

/** The word each kind of wait goes by on screen. */
export const waitWords: Readonly<Record<WaitKind, string>> = {
  response: "reply",
  review: "review",
  close: "close",
};

/**
 * What owed says above its rows while the settings list nobody as team.
 * Every login then counts as outside the team, so every comment starts a
 * reply wait, the maintainers' own included: the list is wrong rather
 * than full, and nothing on a row says so. The close and review waits
 * stay right, so the rows still show.
 */
export const noTeamNotice = {
  reason: "no team in docket.yaml, so every comment starts a reply wait",
  recovery:
    "list the team under people: in the personal file, then run docket config",
} as const;
