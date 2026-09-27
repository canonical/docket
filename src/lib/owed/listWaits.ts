import buildRow from "./buildRow.js";
import countStates from "./countStates.js";
import type { RepoWaits, WaitList } from "./types.js";

/**
 * Measures and sorts every running wait once, for one instant. Grouping
 * the list, which the reader changes far more often than the data or the
 * time, works on these rows and measures nothing again.
 *
 * Rows sort most overdue first, as a share of each wait's own target, so
 * a reply 12 hours past a 24-hour target ranks above a close 12 hours
 * past a 5-day one. Waits that stand equal keep the order given.
 *
 * @param repos The watched repositories, in the configuration's order.
 */
export default function listWaits(
  repos: readonly RepoWaits[],
  now: Date,
): WaitList {
  const rows = repos
    .flatMap(({ repo, time, waits }) =>
      waits.map((wait) => buildRow(wait, repo.name, time, now)),
    )
    .sort((a, b) => b.overdue - a.overdue);
  const counts = countStates(rows);
  const text = `${counts.over} over · ${counts.soon} soon · ${counts.onTrack} on track`;
  return { rows, counts, summary: { text, fit: "trimmed" } };
}
