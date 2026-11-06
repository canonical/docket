import type { Repo } from "../config/index.js";
import {
  inboxReasonOrder,
  inboxSubjectKinds,
  inboxSubjectWords,
} from "./constants.js";
import describeReason from "./describeReason.js";
import type {
  InboxAddress,
  InboxGroup,
  InboxRow,
  InboxSubjectKind,
} from "./types.js";

/** The rows of one group, with the heading it carries. */
type Section = readonly [heading: string, rows: readonly InboxRow[]];

/** The repository's order: watched repositories first, then others by name. */
function repoOrder(
  rows: readonly InboxRow[],
  repos: readonly Repo[],
): string[] {
  const named = repos.map(({ name }) => name);
  const others = [...new Set(rows.map((row) => row.repo))]
    .filter((repo) => !named.includes(repo))
    .sort();
  return [...named, ...others];
}

/** The rows grouped by repository, each section headed by its short name. */
function byRepo(rows: readonly InboxRow[], repos: readonly Repo[]): Section[] {
  return repoOrder(rows, repos).map((repo) => [
    repo,
    rows.filter((row) => row.repo === repo),
  ]);
}

/** The rows grouped by why GitHub notified, in the fixed reason order. */
function byReason(rows: readonly InboxRow[]): Section[] {
  const sections = inboxReasonOrder.map(
    (reason): Section => [
      describeReason(reason),
      rows.filter((row) => {
        const key = row.notification.reason;
        return (
          key === reason ||
          (reason === "other" && !inboxReasonOrder.includes(key))
        );
      }),
    ],
  );
  return sections;
}

/** The rows grouped by subject kind, in the fixed kind order. */
function byType(rows: readonly InboxRow[]): Section[] {
  return inboxSubjectKinds.map((kind: InboxSubjectKind) => [
    inboxSubjectWords[kind],
    rows.filter((row) => row.subjectKind === kind),
  ]);
}

/**
 * Splits the rows into the sections of an address's grouping. The order
 * of the sections is a fixed rule of each grouping and never follows the
 * sort: repositories in the configuration's order then by name, reasons
 * in their fixed order, and subject kinds as issues, pull requests,
 * discussions, then the rest. Rows keep the sort inside a section, and a
 * section with no rows is left out.
 */
export default function groupRows(
  rows: readonly InboxRow[],
  address: InboxAddress,
  repos: readonly Repo[],
): InboxGroup[] {
  if (rows.length === 0) return [];
  if (address.grouping === "none") return [{ rows }];
  const sections =
    address.grouping === "repo"
      ? byRepo(rows, repos)
      : address.grouping === "reason"
        ? byReason(rows)
        : byType(rows);
  return sections
    .filter(([, members]) => members.length > 0)
    .map(([text, members]) => ({
      heading: {
        text,
        kind: address.grouping === "repo" ? "identifier" : "words",
      },
      rows: members,
    }));
}
