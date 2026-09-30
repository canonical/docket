import type { WindowEvent } from "../events/index.js";
import { invalidFileMark } from "../owed/index.js";
import buildThreadRow from "./buildThreadRow.js";
import type { EventList, RepoEvents } from "./types.js";

const count = (amount: number, noun: string) =>
  `${amount} ${noun}${amount === 1 ? "" : "s"}`;

/**
 * Gathers the events inside the window into rows, once for one instant.
 * Grouping the list works on these rows and builds none of them again.
 * Events stay nested under their thread, newest first, and threads come
 * by their newest event, newest first. Events at the same instant keep
 * the order given, and so do threads.
 *
 * @param repos The watched repositories, in the configuration's order,
 * each with the events already cut to the window. A repository whose own
 * file is invalid has each of its rows marked.
 * @param viewer The login gh is signed in with, when it is known, which
 * marks the viewer among the people each row names.
 */
export default function listEvents(
  repos: readonly RepoEvents[],
  now: Date,
  viewer?: string,
): EventList {
  const newestFirst = (a: WindowEvent, b: WindowEvent) =>
    b.at.getTime() - a.at.getTime();
  const rows = repos
    .flatMap(({ repo, people, threads, events, invalidFile }) => {
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
          viewer,
        );
        return {
          newest: gathered[0],
          row: invalidFile
            ? {
                ...row,
                invalidFile: { text: invalidFileMark, kind: "words" as const },
              }
            : row,
        };
      });
    })
    .sort((a, b) => newestFirst(a.newest, b.newest))
    .map(({ row }) => row);
  const events = rows.reduce((total, row) => total + row.events.length, 0);
  const text = `${count(rows.length, "thread")} · ${count(events, "event")}`;
  return {
    rows,
    counts: { threads: rows.length, events },
    summary: { text, kind: "words" },
  };
}
