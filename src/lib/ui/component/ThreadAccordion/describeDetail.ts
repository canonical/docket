import { describeAge } from "../../../activity/index.js";
import type { WaitRow } from "../../../owed/index.js";
import type {
  RequestDetail,
  Reviewer,
  ThreadDetail,
} from "../../../provider/index.js";
import describeClock from "../../describeClock.js";
import type { DetailLine, DetailText } from "./types.js";

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

/** The latest message in full, who wrote it, and when the reply began. */
function describeReply(row: WaitRow, detail: ThreadDetail, reading: Reading) {
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
    line(`${author} · ${describeAge(at, now)} ago`),
    ...(latest ? [line(latest.body)] : []),
    { ...line(since), optional: true },
  ];
}

/** Who asked for the review and when, what changed since, and the checks. */
function describeReview(row: WaitRow, detail: ThreadDetail, reading: Reading) {
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
  return [
    line(asked ? `asked by ${asked.requester.login} ${age}` : `asked ${age}`),
    line(
      `${count(pushes, "push", "pushes")} since · ${count(detail.files.length, "file", "files")} · +${added} −${removed}`,
    ),
    describeChecks(detail),
  ];
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

/** The thread's age and owners, its last activity, and its labels. */
function describeClose(row: WaitRow, detail: ThreadDetail, reading: Reading) {
  const { now } = reading;
  const { thread, owners } = row.wait;
  const latest = detail.messages.at(-1);
  const labels = thread.labels.map(decodeLabel).join(" · ") || "none";
  return [
    line(
      `age ${describeAge(thread.createdAt, now)} · owner ${owners.join(", ") || "unassigned"}`,
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
function describeStack(row: WaitRow, detail: ThreadDetail, reading: Reading) {
  const { stack } = row.wait.thread;
  if (!stack) return [];
  const { number, position, size, base } = stack;
  const describeNeighbour = (side: string, place: number) => {
    const member = detail.stack?.find((each) => each.position === place);
    if (!member) return [];
    const state =
      member.state === "open"
        ? (reading.waiting[`${row.repo}#${member.number}`] ?? "open")
        : member.state;
    return [`${side} #${member.number} ${state}`];
  };
  const neighbours = [
    ...describeNeighbour("below", position - 1),
    ...describeNeighbour("above", position + 1),
  ];
  return [
    line(
      `${row.repo} stack ${number} · ${position} of ${size} · → ${base}`,
      "muted",
    ),
    ...(neighbours.length > 0 ? [line(neighbours.join(", "), "muted")] : []),
  ];
}

const bodies = {
  response: describeReply,
  review: describeReview,
  close: describeClose,
} as const;

/**
 * Describes what the accordion shows for a row once its thread's details
 * have arrived. A reply shows the latest message in full, who wrote it and
 * when, then when the reply began and its target; a review shows who
 * asked and when, the pushes since, the files and lines changed, and the
 * checks; a close shows the thread's age and owners, its last activity
 * and its labels as `group=value`. A stacked pull request adds the stack
 * lines. Text is given whole: the accordion fits it to its five lines.
 */
export default function describeDetail(
  row: WaitRow,
  detail: ThreadDetail,
  reading: Reading,
): DetailText {
  return {
    body: bodies[row.wait.kind](row, detail, reading),
    stack: describeStack(row, detail, reading),
  };
}
