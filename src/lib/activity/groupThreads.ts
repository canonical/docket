import type { Repo } from "../config/index.js";
import { kindSections, type Person } from "../owed/index.js";
import type { ActivityGrouping, ThreadGroup, ThreadRow } from "./types.js";

type Section = readonly [
  heading: string,
  rows: readonly ThreadRow[],
  kind: "words" | "identifier",
  person?: Person,
];

/**
 * Authors alphabetically, then the threads whose facts were not given,
 * which name no author. GitHub logins ignore case, so one author written
 * two ways is one section, headed as first written.
 */
function sectionAuthors(rows: readonly ThreadRow[]): Section[] {
  const authors = new Map<string, { person: Person; rows: ThreadRow[] }>();
  const unknown: ThreadRow[] = [];
  for (const row of rows) {
    if (!row.author) {
      unknown.push(row);
      continue;
    }
    const key = row.author.text.toLowerCase();
    let section = authors.get(key);
    if (!section) {
      section = { person: row.author, rows: [] };
      authors.set(key, section);
    }
    section.rows.push(row);
  }
  const sections = [...authors]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(
      ([, { person, rows }]): Section => [person.text, rows, "words", person],
    );
  return [...sections, ["unknown author", unknown, "words"]];
}

/**
 * Splits sorted rows into the sections of a grouping. The order of the
 * sections is a fixed rule of each grouping and never follows the sort:
 * kinds as `ISSUES`, `PULL REQUESTS`, `DISCUSSIONS`, authors
 * alphabetically with the threads whose facts were not given last, and
 * repositories in the configuration's order. Rows keep the sort inside a
 * section, and a section with no rows is left out.
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
          ([kind, text]): Section => [
            text,
            rows.filter((row) => row.thread.kind === kind),
            "words",
          ],
        )
      : grouping === "author"
        ? sectionAuthors(rows)
        : repos.map(
            ({ name }): Section => [
              name,
              rows.filter((row) => row.repo === name),
              "identifier",
            ],
          );
  return sections
    .filter(([, members]) => members.length > 0)
    .map(([text, members, kind, person]) => ({
      heading: person ?? { text, kind },
      rows: members,
    }));
}
