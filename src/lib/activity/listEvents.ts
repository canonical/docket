import type { WindowEvent } from "../events/index.js";
import buildThreadRow from "./buildThreadRow.js";
import type {
  ActivityAddress,
  ActivityList,
  RepoEvents,
  ThreadGroup,
} from "./types.js";

const count = (amount: number, noun: string) =>
  `${amount} ${noun}${amount === 1 ? "" : "s"}`;

/**
 * Lists the events inside the window for one address in activity. Events
 * stay nested under their thread, newest first, and threads come by their
 * newest event, newest first. Events at the same instant keep the order
 * given, and so do threads.
 *
 * @param repos The watched repositories, in the configuration's order,
 * each with the events already cut to the window.
 */
export default function listEvents(
  repos: readonly RepoEvents[],
  address: ActivityAddress,
  now: Date,
): ActivityList {
  const newestFirst = (a: WindowEvent, b: WindowEvent) =>
    b.at.getTime() - a.at.getTime();
  const rows = repos
    .flatMap(({ repo, people, threads, events }) => {
      const byNumber = new Map<number, [WindowEvent, ...WindowEvent[]]>();
      for (const event of [...events].sort(newestFirst)) {
        const gathered = byNumber.get(event.thread.number);
        if (gathered) gathered.push(event);
        else byNumber.set(event.thread.number, [event]);
      }
      return [...byNumber.values()].map((gathered) => {
        const { thread } = gathered[0];
        const facts = threads.find(({ number }) => number === thread.number);
        const row = buildThreadRow(
          thread,
          repo.name,
          facts,
          people,
          gathered,
          now,
        );
        return { newest: gathered[0], row };
      });
    })
    .sort((a, b) => newestFirst(a.newest, b.newest))
    .map(({ row }) => row);
  const events = rows.reduce((total, row) => total + row.events.length, 0);
  const groups: ThreadGroup[] = rows.length > 0 ? [{ rows }] : [];
  const text = `${count(rows.length, "thread")} · ${count(events, "event")}`;
  return {
    address,
    groups,
    counts: { threads: rows.length, events },
    summary: { text, fit: "trimmed" },
  };
}
