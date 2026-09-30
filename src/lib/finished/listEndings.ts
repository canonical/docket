import { coverMeasures, type MeasureKind } from "../endings/index.js";
import { invalidFileMark } from "../owed/index.js";
import buildRow from "./buildRow.js";
import countEndings from "./countEndings.js";
import type { EndingList, RepoEndings } from "./types.js";

/**
 * Gathers the threads that finished within the window into rows, once
 * for one instant, and computes the list's figures from them: the counts
 * and how each measure stands. Grouping works on these rows and builds
 * none of them again, and nothing here is kept between builds. Rows come
 * by their ending, newest first; endings at the same instant keep the
 * order given.
 *
 * @param repos The watched repositories, in the configuration's order,
 * each with the threads already cut to the window. A repository whose
 * own file is invalid has each of its rows marked.
 * @param viewer The login gh is signed in with, when it is known, which
 * marks the viewer among the people each row names.
 */
export default function listEndings(
  repos: readonly RepoEndings[],
  now: Date,
  viewer?: string,
): EndingList {
  const rows = repos
    .flatMap(({ repo, people, settings, finished, invalidFile }) =>
      finished.map((thread) => {
        const row = buildRow(thread, repo.name, people, settings, now, viewer);
        return invalidFile
          ? {
              ...row,
              invalidFile: { text: invalidFileMark, fit: "trimmed" as const },
            }
          : row;
      }),
    )
    .sort(
      (a, b) => b.thread.ending.at.getTime() - a.thread.ending.at.getTime(),
    );
  const counts = countEndings(rows);
  const cover = (kind: MeasureKind) =>
    coverMeasures(
      kind,
      rows.map((row) => row.measures[kind]),
    );
  const measures = {
    close: cover("close"),
    firstResponse: cover("firstResponse"),
    firstReview: cover("firstReview"),
  };
  const text = `${counts.merged} merged · ${counts.closed} closed · ${counts.over} over`;
  return { rows, counts, measures, summary: { text, fit: "trimmed" } };
}
