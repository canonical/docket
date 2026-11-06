import type { DurationUnit } from "../clock/index.js";
import type { Place, Section, Settings, View } from "./types.js";

/** The modes a call may name, in the order the arrows reach them. */
export const viewModes: readonly View[] = ["owed", "activity", "finished"];

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
  start: "owed",
  hosts: ["github.com"],
  you: { teams: [] },
};

/**
 * The sections each file may declare. A repository file records a team's
 * practice, so which repositories to watch, the activity windows, the
 * hosts and what describes the person running docket stay personal.
 */
export const sectionsByPlace: Readonly<Record<Place, readonly Section[]>> = {
  personal: [
    "repos",
    "people",
    "time",
    "targets",
    "exempt",
    "activity",
    "start",
    "hosts",
    "you",
  ],
  repository: ["people", "time", "targets", "exempt"],
};

/**
 * The longest duration accepted in each unit, about five years. Nothing
 * docket measures runs that long, and adding working time to a date takes
 * longer the longer the duration.
 */
export const longestDuration: Readonly<Record<DurationUnit, number>> = {
  h: 43_800,
  d: 1_825,
  w: 260,
};
