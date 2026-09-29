import { describeAge } from "../../../activity/index.js";
import type { Owner, WaitRow } from "../../../owed/index.js";
import type { Reviewer, ThreadDetail } from "../../../provider/index.js";
import { tokens } from "../../../tokens/index.js";
import type { Message, Thread, ThreadSummary } from "../../../waits/index.js";
import { loginCells } from "../../constants.js";
import describeClock from "../../describeClock.js";
import markPerson from "../../markPerson.js";
import type { Piece } from "../../types.js";
import type {
  DetailLine,
  DetailText,
  RestingThread,
  ShownDetail,
} from "./types.js";

/** What the details are read with, besides the row and the details. */
export interface Reading {
  readonly now: Date;
  readonly timezone: string;
  readonly waiting: Readonly<Record<string, string>>;
}

const plain = (text: string): Piece => ({ text, fg: tokens["color.text"] });

/** docket's own words about the thread, dimmed as context. */
const muted = (text: string): Piece => ({
  text,
  fg: tokens["color.text.muted"],
});

const failed = (text: string): Piece => ({
  text: `${tokens["glyph.failed"]} ${text}`,
  fg: tokens["color.text.error"],
});

/** The dimmed `…` that ends a line still waiting for the details. */
const pending = muted(` ${tokens["glyph.cut"]}`);

const trimmed = (...pieces: Piece[]): DetailLine => ({
  pieces,
  fit: "trimmed",
});

const wrapped = (piece: Piece): DetailLine => ({
  pieces: [piece],
  fit: "wrapped",
});

const count = (amount: number, one: string, many: string) =>
  `${amount} ${amount === 1 ? one : many}`;

const nameReviewer = (reviewer: Reviewer) =>
  "team" in reviewer ? reviewer.team : reviewer.login;

/** A list of people behind their marks, separated by commas. */
const listPeople = (owners: readonly Owner[]): Piece[] =>
  owners.flatMap((owner, place) => [
    ...(place === 0 ? [] : [plain(", ")]),
    markPerson(owner, Number.POSITIVE_INFINITY),
  ]);

/**
 * A label as `group=value`. A label written `group: value`, the common way
 * to scope a label on GitHub, reads as `group=value`; any other label
 * reads as it is written.
 */
const decodeLabel = (label: string) => label.replace(/^([^:=]+):\s*/, "$1=");

const listOwners = ({ owner, owners }: WaitRow): Owner[] =>
  owners ? [...owners.fields] : owner ? [owner] : [];

/**
 * The owners, whole, when the row cuts a person's login: only the close
 * body names them otherwise. It comes first, so no message pushes it out
 * of the accordion. A team's name, `organisation/team`, never earns the
 * line, cut or not: on a stacked review the line would push the checks
 * out, and nearly every team's name is longer than a login's room.
 */
function describeCutOwners(row: WaitRow): DetailLine[] {
  const owners = listOwners(row);
  const cut = owners.some(
    ({ text }) => !text.includes("/") && Bun.stringWidth(text) > loginCells,
  );
  return cut ? [trimmed(plain("owner "), ...listPeople(owners))] : [];
}

/**
 * The message the reply is owed to: the newest the wait's author wrote,
 * as the snapshot holds it, or, while they have written nothing since,
 * the thread's opening.
 */
function findAwaited(thread: Thread, login: string): Message {
  const key = login.toLowerCase();
  const opening = {
    author: thread.author,
    at: thread.createdAt,
    text: thread.text,
  };
  return [...thread.comments, ...thread.reviews]
    .filter(({ author }) => author.login.toLowerCase() === key)
    .reduce<Message>(
      (newest, message) => (newest.at >= message.at ? newest : message),
      opening,
    );
}

/**
 * Who wrote the message awaiting a reply and how long ago, the message in
 * full, then when the reply began and its target, which shows only when
 * it fits. The snapshot holds all of it, so nothing waits on the details.
 */
function describeReply(row: WaitRow, { now, timezone }: Reading) {
  const { thread, started, target } = row.wait;
  const awaited = findAwaited(thread, row.author.text);
  const day = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    weekday: "short",
  }).format(started);
  const since = `waiting since ${day} ${describeClock(started, timezone)} · target ${target.amount}${target.unit}`;
  return [
    ...describeCutOwners(row),
    trimmed(
      markPerson(row.author, Number.POSITIVE_INFINITY),
      muted(` · ${describeAge(awaited.at, now)} ago`),
    ),
    ...(awaited.text ? [wrapped(plain(awaited.text))] : []),
    { ...wrapped(muted(since)), optional: true },
  ];
}

/** The checks on the head commit, a failure in the error colour. */
function describeChecks({ checks }: ThreadDetail): DetailLine {
  const total = checks.length;
  const failing = checks.filter((check) => check.state === "failing");
  const running = checks.filter((check) => check.state === "running");
  if (total === 0) return trimmed(plain("no checks"));
  if (failing.length > 0) {
    const names = failing.map(({ name }) => name).join(", ");
    return trimmed(
      failed(`checks: ${failing.length} of ${total} failed (${names})`),
    );
  }
  if (running.length > 0) {
    return trimmed(plain(`checks running ${running.length} of ${total}`));
  }
  return trimmed(plain(`checks passed ${total} of ${total}`));
}

/**
 * The checks as the snapshot tells them, before the details say how many
 * and which: the beginning of the line the details give, `✗ checks:` in
 * the error colour, `checks running` or `checks passed`, then the dimmed
 * `…`, so the line grows in place when the read lands.
 */
function describeSnapshotChecks({ checks }: Thread): DetailLine {
  if (checks === undefined) return trimmed(plain("no checks"));
  if (checks === "failing") return trimmed(failed("checks:"), pending);
  const state = checks === "running" ? "checks running" : "checks passed";
  return trimmed(plain(state), pending);
}

/**
 * Who asked for the review and when, the pushes since, then the files and
 * lines changed and the checks. The snapshot gives who asked, when, and
 * the pushes; the files and lines, and which checks failed, wait on the
 * details, their lines ending in a dimmed `…` until they arrive.
 */
function describeReview(
  row: WaitRow,
  detail: ThreadDetail | undefined,
  { now }: Reading,
) {
  const { thread, owners, started } = row.wait;
  const [reviewer] = owners;
  const asked =
    thread.reviewRequests.find(
      (each) => nameReviewer(each.reviewer) === reviewer,
    ) ?? thread.reviewRequests.at(-1);
  const since = asked?.at ?? started;
  const pushes = thread.pushes.filter((push) => push.at > since).length;
  const age = ` ${describeAge(since, now)} ago`;
  const changes = detail
    ? [
        plain(
          ` · ${count(detail.files.length, "file", "files")} · +${detail.files.reduce((sum, file) => sum + file.additions, 0)} −${detail.files.reduce((sum, file) => sum + file.deletions, 0)}`,
        ),
      ]
    : [plain(" ·"), pending];
  return [
    ...describeCutOwners(row),
    row.requester
      ? trimmed(
          muted("asked by "),
          markPerson(row.requester, Number.POSITIVE_INFINITY),
          muted(age),
        )
      : trimmed(muted(`asked${age}`)),
    trimmed(plain(count(pushes, "push since", "pushes since")), ...changes),
    detail ? describeChecks(detail) : describeSnapshotChecks(thread),
  ];
}

/**
 * The thread's age and owners, its last activity and who made it, and its
 * labels, as the snapshot holds them.
 */
function describeClose(row: WaitRow, { now }: Reading) {
  const { thread } = row.wait;
  const labels = thread.labels.map(decodeLabel).join(" · ") || "none";
  return [
    trimmed(
      plain(`age ${describeAge(thread.createdAt, now)} · owner `),
      // A row always names an owner, `unassigned` when nobody owns it.
      ...listPeople(listOwners(row)),
    ),
    trimmed(
      plain(`last activity ${describeAge(thread.updatedAt, now)} ago`),
      ...(row.lastActor
        ? [plain(" · "), markPerson(row.lastActor, Number.POSITIVE_INFINITY)]
        : []),
    ),
    wrapped(plain(`labels ${labels}`)),
  ];
}

/**
 * A thread no wait runs on, as its details give it: its age and owners,
 * its last activity and its labels. The owners are the row's when it
 * names them; a thread whose row names none, such as a closed one, takes
 * its assignees that are not bots.
 */
function describeRest(
  { owners }: RestingThread,
  detail: ThreadDetail,
  { now }: Reading,
) {
  const latest = detail.messages.at(-1);
  const assigned = detail.assignees
    .filter(({ type }) => type !== "bot")
    .map(({ login }) => login)
    .join(", ");
  const labels = detail.labels.map(decodeLabel).join(" · ") || "none";
  return [
    trimmed(
      plain(
        `age ${describeAge(detail.createdAt, now)} · owner ${(owners ?? assigned) || "unassigned"}`,
      ),
    ),
    trimmed(
      plain(
        `last activity ${describeAge(detail.updatedAt, now)} ago${latest ? ` · ${latest.author.login}` : ""}`,
      ),
    ),
    wrapped(plain(`labels ${labels}`)),
  ];
}

/**
 * The two dimmed lines that end a stacked pull request's accordion: which
 * stack and which place, from the snapshot, then its neighbours below and
 * above, each with its state, or the kind of its running wait while it is
 * open, which waits on the details.
 */
function describeStack(
  repo: string,
  { stack }: ThreadSummary,
  detail: ThreadDetail | undefined,
  reading: Reading,
): DetailLine[] {
  if (!stack) return [];
  const { number, position, size, base } = stack;
  const place = trimmed(
    muted(`${repo} stack ${number} · ${position} of ${size} · → ${base}`),
  );
  if (size < 2) return [place];
  if (!detail) return [place, trimmed(muted(tokens["glyph.cut"]))];
  const describeNeighbour = (side: string, at: number) => {
    const member = detail.stack?.find((each) => each.position === at);
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
  if (neighbours.length === 0) return [place];
  return [place, trimmed(muted(neighbours.join(", ")))];
}

/**
 * Describes what the accordion shows for a row, from the snapshot alone
 * while `detail` is absent and with the details once they arrive. A reply
 * shows who wrote the message awaiting it and when, the message in full,
 * then when the reply began and its target; a review shows who asked and
 * when, the pushes since, the files and lines changed, and the checks; a
 * close shows the thread's age and owners, its last activity and its
 * labels as `group=value`. A reply and a review first name the owners
 * when the row cuts a person's login, and a stacked pull request ends
 * with the stack lines. A line the details complete ends in a dimmed `…`
 * until they arrive and stays one line after, so nothing changes height
 * while loading. A thread no wait runs on, of which the snapshot holds
 * nothing, says `loading…` until its details give the close body.
 * Details marked `partial`, what the snapshot holds while reading is
 * paused, complete no line, and give a thread no wait runs on its close
 * body. Text is given whole: the accordion fits it to its lines.
 */
export default function describeDetail(
  row: WaitRow | RestingThread,
  detail: Exclude<ShownDetail, { readonly resumes: Date }> | undefined,
  reading: Reading,
): DetailText {
  // What the snapshot holds while reading is paused completes no line.
  const read = detail?.partial ? undefined : detail;
  if (!("wait" in row)) {
    if (!detail) {
      return { body: [trimmed(muted("loading…"))], stack: [] };
    }
    return {
      body: describeRest(row, detail, reading),
      stack: describeStack(row.repo, row.thread, read, reading),
    };
  }
  const body =
    row.wait.kind === "response"
      ? describeReply(row, reading)
      : row.wait.kind === "review"
        ? describeReview(row, read, reading)
        : describeClose(row, reading);
  return {
    body,
    stack: describeStack(row.repo, row.wait.thread, read, reading),
  };
}
