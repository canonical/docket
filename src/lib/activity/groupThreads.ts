import type { Repo } from "../config/index.js";
import { kindSections } from "./constants.js";
import type { ActivityGrouping, ThreadGroup, ThreadRow } from "./types.js";

/**
 * Splits sorted rows into the sections of a grouping. The order of the
 * sections is a fixed rule of each grouping and never follows the sort:
 * kinds as `ISSUES`, `PULL REQUESTS`, `DISCUSSIONS`, and repositories in
 * the configuration's order. Rows keep the sort inside a section, and a
 * section with no rows is left out.
 *
 * @param repos The watched repositories, in the configuration's order.
 */
export default function groupThreads(
  rows: readonly ThreadRow[],
  grouping: ActivityGrouping,
  repos: readonly Repo[],
): ThreadGroup[] {
  if (grouping === "none") return rows.length > 0 ? [{ rows }] : [];
  const sections =
    grouping === "kind"
      ? kindSections.map(
          ([kind, text]) =>
            [text, rows.filter((row) => row.thread.kind === kind)] as const,
        )
      : repos.map(
          ({ name }) =>
            [name, rows.filter((row) => row.repo === name)] as const,
        );
  return sections
    .filter(([, members]) => members.length > 0)
    .map(([text, members]) => ({
      heading: { text, fit: "trimmed" },
      rows: members,
    }));
}
