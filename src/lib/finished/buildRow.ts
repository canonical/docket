import { describeAge } from "../activity/index.js";
import { hourMilliseconds, measureDuration } from "../clock/index.js";
import type { People, Settings } from "../config/index.js";
import type { MeasuredEnding } from "../endings/index.js";
import {
  describeOwners,
  describePerson,
  describeWorkingTime,
  threadWords,
} from "../owed/index.js";
import { classify } from "../people/index.js";
import type { FinishedRow } from "./types.js";

/**
 * Builds the row of one finished thread: its ending as its one event
 * line, with who ended it in the actor's slot, and how long it was open
 * against its close target. Each time is written once: a bare figure is
 * an age, and a figure with `open` or `over` is working time, as owed
 * writes it. Line 1 gives the verdict as a duration, `4d over` past the
 * target or `open 3d` within it; a thread a label exempts has no
 * verdict, so line 1 gives the ending's age, as activity does. The
 * measures come with the ending, counted once when it was read, so a row
 * built at each instant counts no working time.
 *
 * @param repo The short name of the thread's repository.
 * @param settings The settings in effect for the thread's repository.
 * @param viewer The login gh is signed in with, when it is known, which
 * marks the viewer among the author, the owners and the ender.
 */
export default function buildRow(
  { thread, measures, openTime }: MeasuredEnding,
  repo: string,
  people: People,
  settings: Settings,
  now: Date,
  viewer?: string,
): FinishedRow {
  const { ending } = thread;
  const { close } = measures;
  const { time } = settings;
  const measured = close.state === "measured" ? close : undefined;
  const open = `open ${describeWorkingTime(openTime)}`;
  const age = describeAge(ending.at, now);
  const over =
    measured?.verdict === "over"
      ? `${describeWorkingTime(openTime - measureDuration(measured.target, time))} over`
      : undefined;
  const actor = ending.by && describePerson(ending.by, people, viewer);
  const owners = thread.assignees
    .filter((account) => classify(account, people) !== "bot")
    .map((account) => describePerson(account, people, viewer));
  const markTrimmed = (text: string) => ({ text, fit: "trimmed" as const });
  return {
    thread,
    repo,
    stacked: thread.stack !== undefined,
    reference: markTrimmed(`${repo}#${thread.number}`),
    kind: markTrimmed(threadWords[thread.kind]),
    distance: markTrimmed(measured ? (over ?? open) : age),
    title: markTrimmed(thread.title),
    author: describePerson(thread.author, people, viewer),
    ...describeOwners(owners),
    ...(thread.draft ? { draft: markTrimmed("draft") } : {}),
    ending: {
      text: markTrimmed(actor ? `${actor.text} ${ending.label}` : ending.label),
      ...(actor ? { actor } : {}),
      action: markTrimmed(ending.label),
      age: markTrimmed(age),
    },
    open: markTrimmed(open),
    ...(measured
      ? {
          target: markTrimmed(
            `target ${measured.target.amount}${measured.target.unit}`,
          ),
          targetHours:
            measureDuration(measured.target, time) / hourMilliseconds,
          verdict: measured.verdict,
        }
      : {}),
    ...(over ? { over: markTrimmed(over) } : {}),
    measures,
  };
}
