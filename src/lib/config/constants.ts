import type { Place, Section, Settings } from "./types.js";

/** The values docket uses wherever no file declares a section. */
export const builtInSettings: Settings = {
  repos: [],
  people: new Map(),
  time: { workdays: ["mon", "tue", "wed", "thu", "fri"], timezone: "UTC" },
  targets: {
    nextMove: {
      response: { amount: 24, unit: "h" },
      review: { amount: 2, unit: "d" },
    },
    close: {
      issue: { amount: 30, unit: "d" },
      pullRequest: { amount: 5, unit: "d" },
      discussion: { amount: 14, unit: "d" },
    },
  },
  exempt: { close: [] },
  activity: [
    { amount: 24, unit: "h" },
    { amount: 48, unit: "h" },
    { amount: 72, unit: "h" },
    { amount: 1, unit: "w" },
  ],
  hosts: ["github.com"],
};

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
