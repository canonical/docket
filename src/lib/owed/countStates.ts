import type { Counts, WaitRow } from "./types.js";

/** Counts the waits in each state, whatever the grouping. */
export default function countStates(rows: readonly WaitRow[]): Counts {
  const count = (state: WaitRow["state"]) =>
    rows.filter((row) => row.state === state).length;
  return {
    over: count("over"),
    soon: count("soon"),
    onTrack: count("onTrack"),
  };
}
