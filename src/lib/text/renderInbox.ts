import {
  describeEmptyInbox,
  type InboxGroup,
  type InboxGrouping,
  type InboxList,
  type InboxRow,
} from "../inbox/index.js";
import { quotedNote } from "./constants.js";
import describeDataAge from "./describeDataAge.js";
import quote from "./quote.js";
import renderFreshness from "./renderFreshness.js";
import renderJson from "./renderJson.js";
import sanitize from "./sanitize.js";
import type { Detail, Format, Freshness } from "./types.js";

/** What the inbox prints: the list, how old its data is, and how to write it. */
export interface InboxAnswer {
  readonly list: InboxList;
  readonly freshness: Freshness;
  readonly format: Format;
  readonly detail: Detail;
}

/** The title: the mode, the filter, then the grouping. */
function title(list: InboxList): string {
  const { address } = list;
  const grouping =
    address.grouping === "none" ? "one list" : `by ${address.grouping}`;
  return `inbox · ${address.filter} · ${grouping}`;
}

/** A notification's browser-only state, as data. */
const browserOnly = (row: InboxRow) => row.reason.text === "browser only";

/** What a section holds, as data: its repository, reason or kind. */
function describeGroupData(group: InboxGroup, grouping: InboxGrouping) {
  const [first] = group.rows;
  if (grouping === "repo") return { repo: first?.repo };
  if (grouping === "reason") return { reason: first?.notification.reason };
  if (grouping === "type") return { kind: first?.subjectKind };
  return {};
}

/** One row as a person reads it: its head, then its title. */
function renderPlainRow(row: InboxRow): string[] {
  const mark = row.unread ? "●" : " ";
  return [
    `${mark} ${sanitize(row.reference.text)} · ${sanitize(row.reason.text)} · ${sanitize(row.distance.text)}`,
    `  ${sanitize(row.title.text)}`,
  ];
}

/** One row as an agent reads it: one line, with the title quoted. */
function renderLlmRow(row: InboxRow): string {
  const mark = row.unread ? "● " : "";
  return `- ${mark}${sanitize(row.reference.text)} · ${sanitize(row.reason.text)} · ${sanitize(row.distance.text)} · ${quote(row.title.text)}`;
}

/** A notification as data, with every value safe to print. */
function describeRowData(row: InboxRow) {
  const { notification } = row;
  return {
    id: notification.id,
    repository: notification.repo,
    reference: row.reference.text,
    title: sanitize(notification.subject.title),
    subject: {
      kind: notification.subject.kind,
      number: notification.subject.number ?? null,
      url: notification.subject.url,
    },
    reason: notification.reason,
    unread: notification.unread,
    browserOnly: browserOnly(row),
    updatedAt: notification.updatedAt.toISOString(),
    lastReadAt: notification.lastReadAt?.toISOString() ?? null,
  };
}

/**
 * Writes the inbox: the notifications the filter keeps, unread first and
 * then newest, in the sections of its grouping. `summary` gives the
 * counts alone. A subject docket cannot detail reads `browser only`.
 */
export default function renderInbox({
  list,
  freshness,
  format,
  detail,
}: InboxAnswer): string {
  const head = title(list);
  const groups = detail === "summary" ? [] : list.groups;
  if (format === "json") {
    return renderJson({
      mode: "inbox",
      filter: list.address.filter,
      grouping: list.address.grouping,
      data: describeDataAge(freshness),
      counts: list.counts,
      ...(detail === "summary"
        ? {}
        : {
            groups: groups.map((group) => ({
              ...describeGroupData(group, list.address.grouping),
              notifications: group.rows.map(describeRowData),
            })),
          }),
    });
  }
  const llm = format === "llm";
  const sections = groups.map((group) => {
    const heading = group.heading && sanitize(group.heading.text);
    const rows = group.rows.flatMap((row) =>
      llm ? [renderLlmRow(row)] : renderPlainRow(row),
    );
    const head = heading ? [llm ? `## ${heading}` : heading] : [];
    return [...head, ...rows].join("\n");
  });
  const lines = [
    llm ? `# ${head}` : head,
    ...renderFreshness(freshness, format),
    ...(llm && sections.length > 0 ? [quotedNote] : []),
    list.summary.fields.map(({ text }) => text).join(" · "),
    ...(list.groups.length === 0
      ? [describeEmptyInbox(list.address).text]
      : []),
  ];
  return `${[lines.join("\n"), ...sections].join("\n\n")}\n`;
}
