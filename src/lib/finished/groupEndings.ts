import type { Repo } from "../config/index.js";
import { type Field, kindSections, type Person } from "../owed/index.js";
import { endingOrder } from "./constants.js";
import type {
  EndingList,
  FinishedAddress,
  FinishedGroup,
  FinishedList,
  FinishedRow,
} from "./types.js";

type Section = readonly [
  heading: Field | undefined,
  rows: readonly FinishedRow[],
];

/**
 * Authors alphabetically, each headed by their login with their group.
 * GitHub logins ignore case, so one author written two ways is one
 * section, headed as first written.
 */
function sectionAuthors(rows: readonly FinishedRow[]): Section[] {
  const authors = new Map<string, { person: Person; rows: FinishedRow[] }>();
  for (const row of rows) {
    const key = row.author.text.toLowerCase();
    let section = authors.get(key);
    if (!section) {
      section = { person: row.author, rows: [] };
      authors.set(key, section);
    }
    section.rows.push(row);
  }
  return [...authors]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([, { person, rows }]): Section => [person, rows]);
}

/**
 * The sections of a grouping, before empty ones are left out. By ending,
 * the sections follow the kinds, then GitHub's order of endings within a
 * kind, each headed by the ending in the provider's words as its rows
 * give them, never in capitals.
 */
function split(
  rows: readonly FinishedRow[],
  grouping: FinishedAddress["grouping"],
  repos: readonly Repo[],
): Section[] {
  switch (grouping) {
    case "none":
      return [[undefined, rows]];
    case "kind":
      return kindSections.map(([kind, text]) => [
        { text, kind: "words" },
        rows.filter((row) => row.thread.kind === kind),
      ]);
    case "author":
      return sectionAuthors(rows);
    case "ending":
      return kindSections.flatMap(([kind]) =>
        endingOrder[kind].map((outcome) => {
          const members = rows.filter(
            ({ thread }) =>
              thread.kind === kind && thread.ending.outcome === outcome,
          );
          const text = members.at(0)?.ending.action.text;
          return [
            text === undefined ? undefined : { text, kind: "words" as const },
            members,
          ] as const;
        }),
      );
    default:
      return repos.map(({ name }) => [
        { text: name, kind: "identifier" as const },
        rows.filter((row) => row.repo === name),
      ]);
  }
}

/**
 * Splits a gathered list into the sections of an address's grouping. It
 * takes no instant, so changing the grouping reuses the rows as built.
 * The order of the sections is a fixed rule of each grouping: kinds as
 * `ISSUES`, `PULL REQUESTS`, `DISCUSSIONS`; authors alphabetically;
 * endings within each kind in GitHub's order; repositories in the
 * configuration's order. Rows keep their order inside a section, a
 * section with no rows is left out, and no heading carries a figure.
 *
 * @param repos The watched repositories, in the configuration's order.
 */
export default function groupEndings(
  list: EndingList,
  address: FinishedAddress,
  repos: readonly Repo[],
): FinishedList {
  const { rows, ...figures } = list;
  const groups: FinishedGroup[] = split(rows, address.grouping, repos)
    .filter(([, members]) => members.length > 0)
    .map(([heading, members]) =>
      heading === undefined ? { rows: members } : { heading, rows: members },
    );
  const { amount, unit } = address.window;
  return {
    address,
    groups,
    ...figures,
    ...(rows.length === 0
      ? {
          empty: {
            text: `nothing merged or closed in ${amount}${unit}`,
            kind: "words",
          },
        }
      : {}),
  };
}
