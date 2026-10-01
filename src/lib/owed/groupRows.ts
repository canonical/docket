import type { Repo } from "../config/index.js";
import { collectStacks } from "../stacks/index.js";
import { kindSections } from "./constants.js";
import type {
  FieldKind,
  OwedGrouping,
  Owner,
  WaitGroup,
  WaitRow,
} from "./types.js";

type Section = readonly [
  heading: string,
  rows: readonly WaitRow[],
  kind: FieldKind,
];

/**
 * An owner's section heading: the owner as the section's rows name them,
 * with their group, so the heading marks them as the rows do; `unassigned`
 * and a team named as plain text stay text.
 */
function findOwner(rows: readonly WaitRow[], text: string): Owner {
  const key = text.toLowerCase();
  const named = rows
    .flatMap((row) => [row.owner, ...(row.owners?.fields ?? [])])
    .find((owner) => owner?.text.toLowerCase() === key);
  return named && "group" in named
    ? { ...named, text }
    : { text, kind: named?.kind ?? "words" };
}

/**
 * Owners alphabetically, then `unassigned`. A wait with two owners is owed
 * by each, so its row sits under both. GitHub logins ignore case, so one
 * owner written two ways is one section, headed as first written.
 */
function sectionOwners(rows: readonly WaitRow[]): Section[] {
  const owners = new Map<string, string>();
  for (const owner of rows.flatMap((row) => row.wait.owners)) {
    const key = owner.toLowerCase();
    if (!owners.has(key)) owners.set(key, owner);
  }
  const sections = [...owners]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([key, owner]): Section => {
      const owns = (row: WaitRow) =>
        row.wait.owners.some((login) => login.toLowerCase() === key);
      return [owner, rows.filter(owns), "person"];
    });
  const unassigned = rows.filter((row) => row.wait.owners.length === 0);
  return [...sections, ["unassigned", unassigned, "words"]];
}

/**
 * Stacks by repository, then stack number, each headed with its full size
 * even when some of its pull requests have no running wait. Inside a
 * stack, rows go by position, bottom first. Rows in no stack come last.
 */
function sectionStacks(rows: readonly WaitRow[], order: string[]): Section[] {
  const placed = rows.map((row) => ({
    row,
    repo: row.repo,
    stack: row.wait.thread.stack,
  }));
  const stacks = collectStacks(placed).sort(
    (a, b) =>
      order.indexOf(a.repo) - order.indexOf(b.repo) || a.number - b.number,
  );
  const sections = stacks.map(({ repo, number, size, base, members }) => {
    const prs = size === 1 ? "1 PR" : `${size} PRs`;
    const heading = `${repo} stack ${number} · ${prs} → ${base}`;
    return [heading, members.map(({ row }) => row), "identifier"] as const;
  });
  return [
    ...sections,
    ["NOT IN A STACK", rows.filter((row) => !row.stacked), "words"],
  ];
}

/**
 * Splits sorted rows into the sections of a grouping. The order of the
 * sections is a fixed rule of each grouping and never follows the sort:
 * kinds as `ISSUES`, `PULL REQUESTS`, `DISCUSSIONS`, as activity's.
 * Rows keep the sort inside a section, except inside a stack, and a
 * section with no rows is left out.
 *
 * @param repos The watched repositories, in the configuration's order,
 * which is the order of the `repo` sections.
 */
export default function groupRows(
  rows: readonly WaitRow[],
  grouping: OwedGrouping,
  repos: readonly Repo[],
): WaitGroup[] {
  if (grouping === "none") return rows.length > 0 ? [{ rows }] : [];
  const order = repos.map(({ name }) => name);
  const sections =
    grouping === "owner"
      ? sectionOwners(rows)
      : grouping === "kind"
        ? kindSections.map(
            ([kind, text]): Section => [
              text,
              rows.filter((row) => row.wait.thread.kind === kind),
              "words",
            ],
          )
        : grouping === "repo"
          ? order.map(
              (name): Section => [
                name,
                rows.filter((row) => row.repo === name),
                "identifier",
              ],
            )
          : sectionStacks(rows, order);
  return sections
    .filter(([, members]) => members.length > 0)
    .map(([text, members, kind]) => ({
      heading: grouping === "owner" ? findOwner(members, text) : { text, kind },
      rows: members,
    }));
}
