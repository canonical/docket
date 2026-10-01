import { describeAge } from "../../../activity/index.js";
import {
  describePerson,
  type Owner,
  type WaitRow,
} from "../../../owed/index.js";
import type { Reviewer, ThreadDetail } from "../../../provider/index.js";
import { tokens } from "../../../tokens/index.js";
import type { Message, Thread, ThreadSummary } from "../../../waits/index.js";
import { loginCells } from "../../constants.js";
import describeClock from "../../describeClock.js";
import { markPerson, measureText, noBreakSpace } from "../../fit/index.js";
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

/** docket's words on a line held to one, which the details complete in place. */
const trimmed = (...pieces: Piece[]): DetailLine => ({
  pieces,
  kind: "words",
  most: 1,
});

/**
 * docket's words on a line held to one that the details complete: it
 * ends in a dimmed `…` until they arrive, which fitting draws.
 */
const pendingLine = (...pieces: Piece[]): DetailLine => ({
  ...trimmed(...pieces),
  pending: true,
});

/**
 * docket's words on a line that wraps, between people and at spaces,
 * naming each person whole.
 */
const wrapped = (...pieces: Piece[]): DetailLine => ({
  pieces,
  kind: "words",
});

const count = (amount: number, one: string, many: string) =>
  `${amount} ${amount === 1 ? one : many}`;

const nameReviewer = (reviewer: Reviewer) =>
  "team" in reviewer ? reviewer.team : reviewer.login;

/** A list of people behind their marks, separated by commas. */
const listPeople = (owners: readonly Owner[]): Piece[] =>
  owners.flatMap((owner, place) => [
    ...(place === 0 ? [] : [plain(", ")]),
    markPerson(owner),
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
 * The owners, each whole, wrapped between them, when the row cuts a
 * person's login: only the close body names them otherwise. It comes
 * first, and takes only the lines the others leave, so it never pushes
 * a review's checks out of the accordion. A team's name,
 * `organisation/team`, never earns the line, cut or not: on a stacked
 * review the line would push the checks out.
 */
function describeCutOwners(row: WaitRow): DetailLine[] {
  const owners = listOwners(row);
  const cut = owners.some(
    ({ text }) => !text.includes("/") && measureText(text) > loginCells,
  );
  return cut
    ? [{ ...wrapped(plain("owner "), ...listPeople(owners)), yields: true }]
    : [];
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
    wrapped(
      markPerson(row.author),
      muted(` · ${describeAge(awaited.at, now)} ago`),
    ),
    ...(awaited.text
      ? [{ pieces: [plain(awaited.text)], kind: "quote" as const }]
      : []),
    { ...wrapped(muted(since)), optional: true },
  ];
}

/**
 * The checks on the head commit, a failure in the error colour. The
 * failing checks' names wrap between names, each kept whole.
 */
function describeChecks({ checks }: ThreadDetail): DetailLine {
  const total = checks.length;
  const failing = checks.filter((check) => check.state === "failing");
  const running = checks.filter((check) => check.state === "running");
  if (total === 0) return trimmed(plain("no checks"));
  if (failing.length > 0) {
    const names = failing
      .map(({ name }) => name.replaceAll(" ", noBreakSpace))
      .join(", ");
    return wrapped(
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
  if (checks === "failing") return pendingLine(failed("checks:"));
  const state = checks === "running" ? "checks running" : "checks passed";
  return pendingLine(plain(state));
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
    : [plain(" ·")];
  return [
    ...describeCutOwners(row),
    row.requester
      ? wrapped(muted("asked by "), markPerson(row.requester), muted(age))
      : trimmed(muted(`asked${age}`)),
    detail
      ? trimmed(plain(count(pushes, "push since", "pushes since")), ...changes)
      : pendingLine(
          plain(count(pushes, "push since", "pushes since")),
          ...changes,
        ),
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
    wrapped(
      plain(`age ${describeAge(thread.createdAt, now)} · owner `),
      // A row always names an owner, `unassigned` when nobody owns it.
      ...listPeople(listOwners(row)),
    ),
    wrapped(
      plain(`last activity ${describeAge(thread.updatedAt, now)} ago`),
      ...(row.lastActor ? [plain(" · "), markPerson(row.lastActor)] : []),
    ),
    wrapped(plain(`labels ${labels}`)),
  ];
}

/**
 * A thread no wait runs on, as its details give it: its age and owners,
 * its last activity and its labels. The owners are the row's when it
 * names them; a thread whose row names none, such as a closed one, takes
 * its assignees that are not bots. Each person, the one who wrote last
 * included, carries their group's mark, from the repository's people.
 */
function describeRest(
  { owners, people, viewer }: RestingThread,
  detail: ThreadDetail,
  { now }: Reading,
) {
  const latest = detail.messages.at(-1);
  const assigned = detail.assignees
    .filter(({ type }) => type !== "bot")
    .map((account) => describePerson(account, people, viewer));
  const named = owners ?? assigned;
  const labels = detail.labels.map(decodeLabel).join(" · ") || "none";
  return [
    wrapped(
      plain(`age ${describeAge(detail.createdAt, now)} · owner `),
      ...(named.length > 0 ? listPeople(named) : [plain("unassigned")]),
    ),
    wrapped(
      plain(`last activity ${describeAge(detail.updatedAt, now)} ago`),
      ...(latest
        ? [
            plain(" · "),
            markPerson(describePerson(latest.author, people, viewer)),
          ]
        : []),
    ),
    wrapped(plain(`labels ${labels}`)),
  ];
}

/**
 * The two dimmed lines that end a stacked pull request's accordion. The
 * place line names the stack and the place in it, from the snapshot, on
 * one line: docket's words and the place stay whole, the repository's
 * short name leaves first, then the base branch is cut once in its
 * middle. The neighbours line names the pull requests below and above,
 * each with its state, or the kind of its running wait while it is open,
 * which waits on the details.
 */
function describeStack(
  repo: string,
  { stack }: ThreadSummary,
  detail: ThreadDetail | undefined,
  reading: Reading,
): DetailLine[] {
  if (!stack) return [];
  const { number, position, size, base } = stack;
  const separator = ` ${tokens["glyph.separator"]} `;
  // One line, where docket's words and the place stay whole: the
  // repository's short name, which line 1's reference already names,
  // leaves first, then the base branch is cut once in its middle.
  const place: DetailLine = {
    pieces: [
      muted(`${repo} `),
      muted(`stack ${number}${separator}${position} of ${size}${separator}→ `),
      muted(base),
    ],
    kind: "identifier",
    most: 1,
    drops: [0],
    cuts: 2,
  };
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
 * Describes what the accordion shows for a row, from the snapshot alone,
 * first `✗ invalid repository file` in a repository whose own file is
 * invalid, as its row writes `✗ file`,
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
  // A repository's invalid file, which a row calls `✗ file`, named in
  // full, first.
  const trouble = row.invalidFile
    ? [wrapped(failed(row.invalidFile.text))]
    : [];
  if (!("wait" in row)) {
    if (!detail) {
      return { body: [...trouble, trimmed(muted("loading…"))], stack: [] };
    }
    return {
      body: [...trouble, ...describeRest(row, detail, reading)],
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
    body: [...trouble, ...body],
    stack: describeStack(row.repo, row.wait.thread, read, reading),
  };
}
