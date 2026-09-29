import { describeAge } from "../../../activity/index.js";
import type { WaitRow } from "../../../owed/index.js";
import type {
  RequestDetail,
  Reviewer,
  ThreadDetail,
} from "../../../provider/index.js";
import type { Checks, ThreadSummary } from "../../../waits/index.js";
import { loginCells } from "../../constants.js";
import describeClock from "../../describeClock.js";
import type {
  DetailLine,
  DetailText,
  RestingThread,
  ShownDetail,
} from "./types.js";

/** Details read, or, while reading is paused, what the snapshot holds. */
type Detail = Exclude<ShownDetail, { readonly resumes: Date }>;

/** What the details are read with, besides the row and the details. */
export interface Reading {
  readonly now: Date;
  readonly timezone: string;
  readonly waiting: Readonly<Record<string, string>>;
}

const line = (text: string, tone: DetailLine["tone"] = "text"): DetailLine => ({
  text,
  tone,
});

/** A line whose rest needs the details read, which is paused. */
const pending = (
  text: string,
  tone: DetailLine["tone"] = "text",
): DetailLine => ({ ...line(text, tone), pending: true });

const count = (amount: number, one: string, many: string) =>
  `${amount} ${amount === 1 ? one : many}`;

const nameReviewer = (reviewer: Reviewer) =>
  "team" in reviewer ? reviewer.team : reviewer.login;

/**
 * A label as `group=value`. A label written `group: value`, the common way
 * to scope a label on GitHub, reads as `group=value`; any other label
 * reads as it is written.
 */
const decodeLabel = (label: string) => label.replace(/^([^:=]+):\s*/, "$1=");

/**
 * The owners, whole, when the row cuts a person's login: only the close
 * body names them otherwise. It comes first, so no message pushes it out
 * of the five lines. A team's name, `organisation/team`, never earns the
 * line, cut or not: on a stacked review the line would push the checks
 * out, and nearly every team's name is longer than a login's room.
 */
function describeCutOwners({ owner, owners }: WaitRow): DetailLine[] {
  const names = [owner, ...(owners?.fields ?? [])].flatMap((field) =>
    field ? [field.text] : [],
  );
  const cut = names.some(
    (name) => !name.includes("/") && Bun.stringWidth(name) > loginCells,
  );
  return cut ? [line(`owner ${names.join(", ")}`)] : [];
}

/**
 * The latest message in full, who wrote it, and when the reply began.
 * While nobody has commented, the latest message is the opening, whose
 * text the snapshot holds.
 */
function describeReply(row: WaitRow, detail: Detail, reading: Reading) {
  const { now, timezone } = reading;
  const { thread, started, target } = row.wait;
  const latest = detail.messages.at(-1);
  const author = latest?.author.login ?? thread.author.login;
  const at = latest?.at ?? thread.createdAt;
  const day = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    weekday: "short",
  }).format(started);
  const since = `waiting since ${day} ${describeClock(started, timezone)} · target ${target.amount}${target.unit}`;
  return [
    ...describeCutOwners(row),
    line(`${author} · ${describeAge(at, now)} ago`),
    ...(latest
      ? [detail.partial ? pending("") : line(latest.body)]
      : thread.text
        ? [line(thread.text)]
        : []),
    { ...line(since), optional: true },
  ];
}

/** Who asked for the review and when, what changed since, and the checks. */
function describeReview(row: WaitRow, detail: Detail, reading: Reading) {
  const { thread, owners, started } = row.wait;
  const [reviewer] = owners;
  const asked: RequestDetail | undefined =
    detail.requests.find((each) => nameReviewer(each.reviewer) === reviewer) ??
    detail.requests.at(-1);
  const since = asked?.at ?? started;
  const pushes = thread.pushes.filter((push) => push.at > since).length;
  const added = detail.files.reduce((sum, file) => sum + file.additions, 0);
  const removed = detail.files.reduce((sum, file) => sum + file.deletions, 0);
  const age = `${describeAge(since, reading.now)} ago`;
  const pushed = `${count(pushes, "push", "pushes")} since`;
  // The snapshot holds neither who asked nor the files, nor which check
  // failed: only the checks' roll-up.
  if (detail.partial) {
    return [
      ...describeCutOwners(row),
      pending(`asked ${age}`),
      pending(pushed),
      describeRollUp(thread.checks),
    ];
  }
  return [
    ...describeCutOwners(row),
    line(asked ? `asked by ${asked.requester.login} ${age}` : `asked ${age}`),
    line(
      `${pushed} · ${count(detail.files.length, "file", "files")} · +${added} −${removed}`,
    ),
    describeChecks(detail),
  ];
}

/** The checks as the snapshot rolls them up, before they are read. */
function describeRollUp(checks: Checks | undefined): DetailLine {
  if (checks === undefined) return line("no checks");
  if (checks === "failing") return pending("✗ checks failed", "error");
  return pending(checks === "running" ? "checks running" : "checks passed");
}

/** The checks on the head commit, a failure in the error colour. */
function describeChecks({ checks }: ThreadDetail): DetailLine {
  const total = checks.length;
  const failed = checks.filter((check) => check.state === "failing");
  const running = checks.filter((check) => check.state === "running");
  if (total === 0) return line("no checks");
  if (failed.length > 0) {
    const names = failed.map(({ name }) => name).join(", ");
    return line(
      `✗ checks: ${failed.length} of ${total} failed (${names})`,
      "error",
    );
  }
  if (running.length > 0) {
    return line(`checks running ${running.length} of ${total}`);
  }
  return line(`checks passed ${total} of ${total}`);
}

/**
 * The thread's age and owners, its last activity, and its labels, as its
 * details give them. The owners are the row's when it names them; a
 * thread whose row names none, such as a closed one, takes its assignees
 * that are not bots.
 */
function describeClose(
  { owners }: Pick<RestingThread, "owners">,
  detail: Detail,
  { now }: Reading,
) {
  const latest = detail.messages.at(-1);
  const assigned = detail.assignees
    .filter(({ type }) => type !== "bot")
    .map(({ login }) => login)
    .join(", ");
  const labels = detail.labels.map(decodeLabel).join(" · ") || "none";
  return [
    line(
      `age ${describeAge(detail.createdAt, now)} · owner ${(owners ?? assigned) || "unassigned"}`,
    ),
    line(
      `last activity ${describeAge(detail.updatedAt, now)} ago${latest ? ` · ${latest.author.login}` : ""}`,
    ),
    line(`labels ${labels}`),
  ];
}

/**
 * The two dimmed lines that end a stacked pull request's accordion: which
 * stack and which place, then its neighbours below and above, each with
 * its state, or the kind of its running wait while it is open.
 */
function describeStack(
  repo: string,
  { stack }: ThreadSummary,
  detail: Detail,
  reading: Reading,
) {
  if (!stack) return [];
  const where = line(
    `${repo} stack ${stack.number} · ${stack.position} of ${stack.size} · → ${stack.base}`,
    "muted",
  );
  if (detail.partial) return [where, pending("", "muted")];
  const { position } = stack;
  const describeNeighbour = (side: string, place: number) => {
    const member = detail.stack?.find((each) => each.position === place);
    if (!member) return [];
    const state =
      member.state === "open"
        ? (reading.waiting[`${repo}#${member.number}`] ?? "open")
        : member.state;
    return [`${side} #${member.number} ${state}`];
  };
  const neighbours = [
    ...describeNeighbour("below", position - 1),
    ...describeNeighbour("above", position + 1),
  ];
  return [
    where,
    ...(neighbours.length > 0 ? [line(neighbours.join(", "), "muted")] : []),
  ];
}

const bodies = {
  response: describeReply,
  review: describeReview,
  close: ({ wait }: WaitRow, detail: Detail, reading: Reading) =>
    describeClose({ owners: wait.owners.join(", ") }, detail, reading),
} as const;

/**
 * Describes what the accordion shows for a row once its thread's details
 * have arrived. A reply shows the latest message in full, who wrote it and
 * when, then when the reply began and its target; a review shows who
 * asked and when, the pushes since, the files and lines changed, and the
 * checks; a close shows the thread's age and owners, its last activity
 * and its labels as `group=value`, and so does a thread no wait runs on.
 * A reply and a review first name the owners when the row cuts a
 * person's login. A stacked pull request adds the stack lines. Text is
 * given whole: the accordion fits it to its five lines. Details marked
 * `partial`, what the snapshot holds while reading is paused, give each
 * line that needs the read as pending: a reply's text, who asked for a
 * review, the files and lines changed, which check failed, and the stack's
 * neighbours.
 */
export default function describeDetail(
  row: WaitRow | RestingThread,
  detail: Detail,
  reading: Reading,
): DetailText {
  if (!("wait" in row)) {
    return {
      body: describeClose(row, detail, reading),
      stack: describeStack(row.repo, row.thread, detail, reading),
    };
  }
  return {
    body: bodies[row.wait.kind](row, detail, reading),
    stack: describeStack(row.repo, row.wait.thread, detail, reading),
  };
}
