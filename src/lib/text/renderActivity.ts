import {
  type ActivityList,
  describeAddress,
  type EventLine,
  type ThreadRow,
} from "../activity/index.js";
import { kindWords, quotedNote } from "./constants.js";
import describeDataAge from "./describeDataAge.js";
import describeOwners from "./describeOwners.js";
import describeStack from "./describeStack.js";
import describeTime from "./describeTime.js";
import listOwners from "./listOwners.js";
import quote from "./quote.js";
import renderFreshness from "./renderFreshness.js";
import renderJson from "./renderJson.js";
import sanitize from "./sanitize.js";
import type { Detail, Format, Freshness } from "./types.js";

/** What activity prints: the list, how old its data is, and how to write it. */
export interface ActivityAnswer {
  readonly list: ActivityList;
  readonly freshness: Freshness;
  readonly format: Format;
  readonly detail: Detail;
}

/** The owners, the draft mark and the stack, where the row has them. */
function listFacts(row: ThreadRow): string[] {
  const owners = listOwners(row);
  const { stack } = row.thread;
  return [
    ...(owners.length > 0 ? [owners.join(", ")] : []),
    ...(row.draft ? ["draft"] : []),
    ...(stack ? [describeStack(row.repo, stack)] : []),
  ];
}

/**
 * The logins that own the thread, none when it is unassigned, or
 * `undefined` when the thread's facts were not given.
 */
function listOwnerNames(row: ThreadRow): string[] | undefined {
  if (!row.owner && !row.owners) return undefined;
  if (row.owner?.text === "unassigned") return [];
  return listOwners(row);
}

const describeEventLine = ({ event, text }: EventLine) =>
  `${sanitize(text.text)}${event.bot ? " (bot)" : ""}`;

function renderLlmRow(row: ThreadRow, timezone: string): string[] {
  const owners = listOwnerNames(row);
  const parts = [
    row.reference.text,
    quote(row.title.text),
    kindWords[row.thread.kind],
    ...(owners ? [describeOwners(owners)] : []),
    ...(row.draft ? ["draft"] : []),
    ...(row.thread.stack ? [describeStack(row.repo, row.thread.stack)] : []),
    `newest event ${row.distance.text} ago`,
  ];
  const events = row.events.map(
    (line) =>
      `  - ${describeEventLine(line)} · ${line.age.text} ago, ${describeTime(line.event.at, timezone)}`,
  );
  return [`- ${parts.join(" · ")}`, ...events];
}

function renderPlainRow(row: ThreadRow, timezone: string, detail: Detail) {
  const events = row.events.map((line) => {
    const when =
      detail === "detailed"
        ? `${line.age.text} ago, ${describeTime(line.event.at, timezone)}`
        : `${line.age.text} ago`;
    return `  ${describeEventLine(line)} · ${when}`;
  });
  const extra = listFacts(row);
  return [
    `${row.reference.text} · ${row.kind.text} · ${row.distance.text}`,
    `  ${sanitize(row.title.text)}`,
    ...(extra.length > 0 ? [`  ${extra.join(" · ")}`] : []),
    ...events,
  ];
}

function describeRowData(row: ThreadRow) {
  const owners = listOwnerNames(row) ?? null;
  return {
    reference: row.reference.text,
    title: sanitize(row.title.text),
    kind: row.thread.kind,
    owners,
    draft: row.draft !== undefined,
    stack: row.thread.stack ?? null,
    events: row.events.map(({ event, text }) => ({
      kind: event.kind,
      actor: sanitize(event.actor.login),
      bot: event.bot,
      text: sanitize(text.text),
      at: event.at.toISOString(),
    })),
  };
}

/**
 * Writes activity: every thread with events in the window, newest first,
 * its events under it, in the sections of its grouping. `summary` gives
 * the counts alone; `detailed` adds each event's absolute time for a
 * person, which an agent always reads.
 */
export default function renderActivity({
  list,
  freshness,
  format,
  detail,
}: ActivityAnswer): string {
  const header = describeAddress(list.address);
  const title = `${header.title.text} · ${header.address?.text}`;
  const { timezone } = freshness;
  const groups = detail === "summary" ? [] : list.groups;
  if (format === "json") {
    const { amount, unit } = list.address.window;
    const answer = {
      mode: list.address.mode,
      window: `${amount}${unit}`,
      grouping: list.address.grouping,
      data: describeDataAge(freshness),
      counts: list.counts,
      ...(detail === "summary"
        ? {}
        : {
            groups: groups.map((group) => ({
              heading: group.heading?.text ?? null,
              threads: group.rows.map(describeRowData),
            })),
          }),
    };
    return renderJson(answer);
  }
  const llm = format === "llm";
  const sections = groups.map((group) => {
    const heading = group.heading && sanitize(group.heading.text);
    const rows = group.rows.flatMap((row) =>
      llm ? renderLlmRow(row, timezone) : renderPlainRow(row, timezone, detail),
    );
    const head = heading ? [llm ? `## ${heading}` : heading] : [];
    return [...head, ...rows].join("\n");
  });
  const lines = [
    llm ? `# ${title}` : title,
    ...renderFreshness(freshness, format),
    ...(llm && sections.length > 0 ? [quotedNote] : []),
    list.summary.text,
  ];
  return `${[lines.join("\n"), ...sections].join("\n\n")}\n`;
}
