import type { Place, Section } from "./types.js";

/**
 * The sections each file may declare. A repository file records a team's
 * practice, so which repositories to watch, the activity windows and the
 * hosts stay personal.
 */
export const sectionsByPlace: Readonly<Record<Place, readonly Section[]>> = {
  personal: [
    "repos",
    "people",
    "time",
    "targets",
    "exempt",
    "activity",
    "hosts",
  ],
  repository: ["people", "time", "targets", "exempt"],
};
