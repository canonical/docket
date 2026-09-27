import {
  type ActivityGrouping,
  type ActivityList,
  describeAddress,
  describeEvent,
  type EventLine,
  type ThreadGroup,
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

/**
 * The owners, the draft mark, the stack and the invalid-file mark, where
 * the row has them.
 */
function listFacts(row: ThreadRow): string[] {
  const owners = listOwners(row);
  const { stack } = row.thread;
  return [
    ...(owners.length > 0 ? [owners.join(", ")] : []),
    ...(row.draft ? ["draft"] : []),
    ...(stack ? [describeStack(row.repo, stack)] : []),
    ...(row.invalidFile ? [row.invalidFile.text] : []),
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

/**
 * One event in words: as the list gives it for a person, and for an agent
 * with every login, label and check name quoted as data.
 */
const describeEventLine = ({ event, text }: EventLine, llm = false) =>
  `${llm ? describeEvent(event, quote) : sanitize(text.text)}${event.bot ? " (bot)" : ""}`;

function renderLlmRow(row: ThreadRow, timezone: string): string[] {
  const owners = listOwnerNames(row);
  const parts = [
    row.reference.text,
    quote(row.title.text),
    kindWords[row.thread.kind],
    ...(owners ? [describeOwners(owners.map((login) => quote(login)))] : []),
    ...(row.draft ? ["draft"] : []),
    ...(row.thread.stack ? [describeStack(row.repo, row.thread.stack)] : []),
    ...(row.invalidFile ? [row.invalidFile.text] : []),
    `newest event ${row.distance.text} ago`,
  ];
  const events = row.events.map(
    (line) =>
      `  - ${describeEventLine(line, true)} · ${line.age.text} ago, ${describeTime(line.event.at, timezone)}`,
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
    invalidRepositoryFile: row.invalidFile !== undefined,
    events: row.events.map(({ event }) => {
      // What the event carries beyond its thread, its actor and its time:
      // its kind, whether a bot made it, and its label, assignee, commits
      // or checks.
      const { thread: _thread, actor, at, ...facts } = event;
      return { ...facts, actor: actor.login, at: at.toISOString() };
    }),
  };
}

/**
 * What a section holds, as data: the kind of its threads, or their
 * repository. A section always holds a row.
 */
function describeGroupData(group: ThreadGroup, grouping: ActivityGrouping) {
  const [first] = group.rows;
  if (grouping === "kind") return { kind: first?.thread.kind };
  if (grouping === "repo") return { repo: first?.repo };
  return {};
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
              ...describeGroupData(group, list.address.grouping),
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
