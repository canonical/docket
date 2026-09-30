import { describeAddress } from "../activity/index.js";
import type {
  FinishedGroup,
  FinishedGrouping,
  FinishedList,
  FinishedRow,
} from "../finished/index.js";
import { groupWords, kindWords, quotedNote } from "./constants.js";
import describeDataAge from "./describeDataAge.js";
import describeFinishedData from "./describeFinishedData.js";
import describeOwners from "./describeOwners.js";
import describeStack from "./describeStack.js";
import describeTime from "./describeTime.js";
import listOwners from "./listOwners.js";
import quote from "./quote.js";
import renderFreshness from "./renderFreshness.js";
import renderJson from "./renderJson.js";
import sanitize from "./sanitize.js";
import type { Detail, Format, Freshness } from "./types.js";

/** What finished prints: the list, how old its data is, and how to write it. */
export interface FinishedAnswer {
  readonly list: FinishedList;
  readonly freshness: Freshness;
  readonly format: Format;
  readonly detail: Detail;
}

/** The logins that own the thread, none when it is unassigned. */
const listOwnerNames = (row: FinishedRow) =>
  row.owner?.text === "unassigned" ? [] : listOwners(row);

/** The draft mark, the stack and the invalid-file mark, where the row has them. */
const listMarks = (row: FinishedRow) => [
  ...(row.draft ? ["draft"] : []),
  ...(row.thread.stack ? [describeStack(row.repo, row.thread.stack)] : []),
  ...(row.invalidFile ? [row.invalidFile.text] : []),
];

/**
 * How long the thread was open against its close target, in words: `open
 * 9d, target 5d, 4d over` or `open 2d, target 30d`; a thread a label
 * exempts has no target, so only `open 2d`.
 */
function describeClose(row: FinishedRow): string {
  if (!row.target) return row.open.text;
  return [row.open, row.target, ...(row.over ? [row.over] : [])]
    .map(({ text }) => text)
    .join(", ");
}

/** One thread as one complete line, for an agent. */
function renderLlmRow(row: FinishedRow, timezone: string): string {
  const { ending, author } = row;
  const by = ending.actor
    ? ` by ${quote(ending.actor.text)} (${groupWords[ending.actor.group]})`
    : "";
  const parts = [
    row.reference.text,
    quote(row.title.text),
    kindWords[row.thread.kind],
    `${ending.action.text}${by}`,
    `${ending.age.text} ago, ${describeTime(row.thread.ending.at, timezone)}`,
    describeClose(row),
    `author ${quote(author.text)} (${groupWords[author.group]})`,
    describeOwners(listOwnerNames(row).map((login) => quote(login))),
    ...listMarks(row),
  ];
  return `- ${parts.join(" · ")}`;
}

/**
 * One thread as a person reads it, as activity writes a row: line 1 with
 * the verdict, the title, its owners and marks, its ending as its event,
 * then what line 1 does not say of the close target: `open 9d · target
 * 5d` past it, `target 30d` within it, and nothing when a label exempts
 * the thread.
 */
function renderPlainRow(row: FinishedRow, timezone: string, detail: Detail) {
  const { ending } = row;
  const when =
    detail === "detailed"
      ? `${ending.age.text} ago, ${describeTime(row.thread.ending.at, timezone)}`
      : `${ending.age.text} ago`;
  const facts = [listOwners(row).join(", "), ...listMarks(row)];
  const time = row.over ? [row.open, row.target] : [row.target];
  const target = time.flatMap((field) => (field ? [field.text] : []));
  return [
    `${row.reference.text} · ${row.kind.text} · ${row.distance.text}`,
    `  ${sanitize(row.title.text)}`,
    `  ${facts.join(" · ")}`,
    `  ${sanitize(ending.text.text)} · ${when}`,
    ...(target.length > 0 ? [`  ${target.join(" · ")}`] : []),
  ];
}

/**
 * What a section holds, as data: the kind of its threads, with their
 * outcome by ending, or their repository. A section always holds a row.
 */
function describeGroupData(group: FinishedGroup, grouping: FinishedGrouping) {
  const [first] = group.rows;
  if (grouping === "kind") return { kind: first?.thread.kind };
  if (grouping === "ending") {
    return { kind: first?.thread.kind, outcome: first?.thread.ending.outcome };
  }
  if (grouping === "repo") return { repo: first?.repo };
  return {};
}

/**
 * Writes finished: every thread merged or closed within the window and
 * still so, newest ending first, in the sections of its grouping, after
 * the counts. `summary` gives the counts alone; `detailed` adds each
 * ending's absolute time for a person, which an agent always reads. In
 * JSON, the counts come split by kind and outcome, and each measure with
 * how it stands across the list.
 */
export default function renderFinished({
  list,
  freshness,
  format,
  detail,
}: FinishedAnswer): string {
  const header = describeAddress(list.address);
  const title = `${header.title.text} · ${header.address?.text}`;
  const { timezone } = freshness;
  const groups = detail === "summary" ? [] : list.groups;
  if (format === "json") {
    const { amount, unit } = list.address.window;
    const { merged, closed, over, byKind } = list.counts;
    const answer = {
      mode: list.address.mode,
      window: `${amount}${unit}`,
      grouping: list.address.grouping,
      data: describeDataAge(freshness),
      counts: { merged, closed, over: over.value, byKind },
      // Each measure's availability; its figure over the list, with how
      // many threads that figure covers, comes with the figure.
      measures: {
        close: { state: list.measures.close.state },
        firstResponse: { state: list.measures.firstResponse.state },
        firstReview: { state: list.measures.firstReview.state },
      },
      ...(detail === "summary"
        ? {}
        : {
            groups: groups.map((group) => ({
              ...describeGroupData(group, list.address.grouping),
              threads: group.rows.map(describeFinishedData),
            })),
          }),
    };
    return renderJson(answer);
  }
  const llm = format === "llm";
  const sections = groups.map((group) => {
    const heading = group.heading && sanitize(group.heading.text);
    const rows = group.rows.flatMap((row) =>
      llm
        ? [renderLlmRow(row, timezone)]
        : renderPlainRow(row, timezone, detail),
    );
    const head = heading ? [llm ? `## ${heading}` : heading] : [];
    return [...head, ...rows].join("\n");
  });
  const { counts } = list;
  const summary = llm
    ? `${counts.merged} merged · ${counts.closed} closed · ${counts.over.value} over target`
    : list.summary.text;
  const lines = [
    llm ? `# ${title}` : title,
    ...renderFreshness(freshness, format),
    ...(llm && sections.length > 0 ? [quotedNote] : []),
    summary,
    ...(list.empty ? [list.empty.text] : []),
  ];
  return `${[lines.join("\n"), ...sections].join("\n\n")}\n`;
}
