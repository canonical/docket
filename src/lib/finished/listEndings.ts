import { coverMeasures, type MeasureKind } from "../endings/index.js";
import { invalidFileMark } from "../owed/index.js";
import buildRow from "./buildRow.js";
import countEndings from "./countEndings.js";
import type { EndingList, FinishedRow, RepoEndings } from "./types.js";

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
 * own file is invalid has each of its rows marked. The pull request
 * that closed an issue is named by its repository's short name when it
 * is watched, as the rows are.
 * @param viewer The login gh is signed in with, when it is known, which
 * marks the viewer among the people each row names.
 */
export default function listEndings(
  repos: readonly RepoEndings[],
  now: Date,
  viewer?: string,
): EndingList {
  // A closer in a watched repository goes by its short name, as the
  // rows' own references do.
  const names = new Map(repos.map(({ repo }) => [repo.repo, repo.name]));
  const rows = repos
    .flatMap(({ repo, people, settings, finished, invalidFile }) =>
      finished.map((ending): FinishedRow => {
        const row = buildRow(ending, repo.name, people, settings, now, viewer);
        const { closer } = ending.thread.ending;
        return {
          ...row,
          ...(closer?.kind === "pullRequest"
            ? {
                closer: {
                  text: `${names.get(closer.repo) ?? closer.repo}#${closer.number}`,
                  kind: "identifier",
                },
              }
            : {}),
          ...(invalidFile
            ? { invalidFile: { text: invalidFileMark, kind: "words" } }
            : {}),
        };
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
  // The parts in the order they are read; a face too narrow for all of
  // them leaves out the last whole.
  const fields = [
    `${counts.merged} merged`,
    `${counts.closed} closed`,
    `${counts.over.value} over`,
  ].map((text) => ({ text, kind: "words" as const }));
  return { rows, counts, measures, summary: { fields } };
}
