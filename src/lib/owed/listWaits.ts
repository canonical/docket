import buildRow from "./buildRow.js";
import countStates from "./countStates.js";
import groupRows from "./groupRows.js";
import type { OwedAddress, OwedList, RepoWaits } from "./types.js";

/**
 * Lists every running wait for one address in owed.
 *
 * Rows sort most overdue first, as a share of each wait's own target, so
 * a reply 12 hours past a 24-hour target ranks above a close 12 hours
 * past a 5-day one. Waits that stand equal keep the order given.
 *
 * @param repos The watched repositories, in the configuration's order.
 */
export default function listWaits(
  repos: readonly RepoWaits[],
  address: OwedAddress,
  now: Date,
): OwedList {
  const rows = repos
    .flatMap(({ repo, time, waits }) =>
      waits.map((wait) => buildRow(wait, repo.name, time, now)),
    )
    .sort((a, b) => b.overdue - a.overdue);
  const counts = countStates(rows);
  const groups = groupRows(
    rows,
    address.grouping,
    repos.map(({ repo }) => repo),
  );
  const text = `${counts.over} over · ${counts.soon} soon · ${counts.onTrack} on track`;
  return { address, groups, counts, summary: { text, fit: "trimmed" } };
}
