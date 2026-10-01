import buildRow from "./buildRow.js";
import { invalidFileMark } from "./constants.js";
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
 * @param repos The watched repositories, in the configuration's order. A
 * repository whose own file is invalid has each of its rows marked.
 * @param viewer The login gh is signed in with, when it is known, which
 * marks the viewer among the people each row names.
 */
export default function listWaits(
  repos: readonly RepoWaits[],
  now: Date,
  viewer?: string,
): WaitList {
  const rows = repos
    .flatMap(({ repo, time, waits, people, yours, invalidFile }) =>
      waits.map((wait) => {
        const row = buildRow(wait, repo.name, time, now, people, yours, viewer);
        return invalidFile
          ? {
              ...row,
              invalidFile: { text: invalidFileMark, kind: "words" as const },
            }
          : row;
      }),
    )
    .sort((a, b) => b.overdue - a.overdue);
  const counts = countStates(rows);
  // The parts in the order of their urgency, the most urgent first.
  const fields = [
    `${counts.over} over`,
    `${counts.soon} soon`,
    `${counts.onTrack} on track`,
  ].map((text) => ({ text, kind: "words" as const }));
  return { rows, counts, summary: { fields } };
}
