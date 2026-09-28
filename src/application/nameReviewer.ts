import type { Reviewer } from "../lib/provider/index.js";

/** A reviewer as a set names it: a person's login, or a team's `org/team`. */
export default function nameReviewer(reviewer: Reviewer): string {
  return "team" in reviewer ? reviewer.team : reviewer.login;
}
