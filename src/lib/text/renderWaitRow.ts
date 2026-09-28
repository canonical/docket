import type { WaitRow } from "../owed/index.js";
import describeOwners from "./describeOwners.js";
import describeStack from "./describeStack.js";
import describeTime from "./describeTime.js";
import quote from "./quote.js";
import sanitize from "./sanitize.js";
import type { Detail } from "./types.js";

/** The facts of one row that every format states. */
function describeRow(row: WaitRow, timezone: string) {
  const { thread, due, started, target } = row.wait;
  return {
    reference: row.reference.text,
    kind: row.kind.text,
    owners: row.wait.owners.map((login) => sanitize(login)),
    distance: row.distance.text,
    soon: row.state === "soon",
    due: describeTime(due, timezone),
    started: describeTime(started, timezone),
    target: `${target.amount}${target.unit}`,
    draft: row.draft !== undefined,
    checksFailing: thread.checks === "failing",
    stack: thread.stack && describeStack(row.repo, thread.stack),
  };
}

type Described = ReturnType<typeof describeRow>;

const describeDistance = ({ distance, soon }: Described) =>
  soon ? `${distance}, due soon` : distance;

/** The extras a row shows after its title, in words. */
const listMarks = (described: Described) => [
  ...(described.draft ? ["draft"] : []),
  ...(described.checksFailing ? ["checks failing"] : []),
  ...(described.stack ? [described.stack] : []),
];

/** One row as one complete line, for an agent. */
function renderLlmRow(row: WaitRow, timezone: string, detail: Detail): string {
  const described = describeRow(row, timezone);
  const parts = [
    described.reference,
    quote(row.title.text),
    described.kind,
    describeOwners(described.owners.map((login) => quote(login))),
    describeDistance(described),
    `due ${described.due}`,
    ...listMarks(described),
    ...(detail === "detailed"
      ? [`waiting since ${described.started}`, `target ${described.target}`]
      : []),
  ];
  return `- ${parts.join(" · ")}`;
}

/** One row as a person reads it: the reference line, the title, the rest. */
function renderPlainRow(
  row: WaitRow,
  timezone: string,
  detail: Detail,
): string[] {
  const described = describeRow(row, timezone);
  const owners = described.owners.join(", ") || "unassigned";
  const facts = [owners, ...listMarks(described)];
  return [
    `${described.reference} · ${described.kind} · ${describeDistance(described)}`,
    `  ${sanitize(row.title.text)}`,
    `  ${facts.join(" · ")}`,
    ...(detail === "detailed"
      ? [
          `  since ${described.started} · target ${described.target} · due ${described.due}`,
        ]
      : []),
  ];
}

/**
 * Writes one running wait: for an agent, one complete line with the title
 * quoted, the owners, the distance and the absolute due time; for a
 * person, the reference line, the title, then the owners and marks.
 * `detailed` adds when the wait started and its target.
 */
export default function renderWaitRow(
  row: WaitRow,
  format: "plain" | "llm",
  timezone: string,
  detail: Detail,
): string[] {
  return format === "llm"
    ? [renderLlmRow(row, timezone, detail)]
    : renderPlainRow(row, timezone, detail);
}
