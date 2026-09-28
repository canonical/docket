import { gatherPeople, listWaits } from "../lib/owed/index.js";
import { renderThread, type ShownThread } from "../lib/text/index.js";
import { findWaits } from "../lib/waits/index.js";
import fail from "./fail.js";
import findThreads from "./findThreads.js";
import parseReference from "./parseReference.js";
import readThreads from "./readThreads.js";
import type { Session } from "./types.js";

/**
 * Answers `docket show`: the thread, or each pull request of the stack,
 * with its details, which GitHub gives on each call, and its waits.
 *
 * @note Impure: reads the cache, asks GitHub for the thread's details,
 * and writes the answer.
 */
export default async function answerShow(session: Session): Promise<number> {
  const { context, invocation, watched, provider } = session;
  const { positionals } = invocation;
  const reference = parseReference(positionals, watched, "show");
  const { settings, repositoryErrors } = reference.repo.resolved;
  if (positionals.length > reference.length) {
    fail(
      "USAGE_UNEXPECTED_ARGUMENT",
      `docket show takes one reference, and was given \`${positionals.join(" ")}\`.`,
      "run docket show --help",
    );
  }
  const { threads, syncedAt, warnings } = await readThreads(session);
  const now = context.now();
  const shown: ShownThread[] = [];
  const people = gatherPeople(
    threads.filter((thread) => thread.repo === reference.repo.repo),
    settings.people,
  );
  for (const thread of findThreads(threads, reference)) {
    const { rows } = listWaits(
      [
        {
          repo: reference.repo,
          time: settings.time,
          people,
          waits: findWaits(thread, settings),
          invalidFile: repositoryErrors.length > 0,
        },
      ],
      now,
    );
    shown.push({
      reference: `${reference.repo.name}#${thread.number}`,
      repo: reference.repo.name,
      thread,
      details: await provider.threadDetail(thread),
      rows,
    });
  }
  context.write(
    renderThread({
      reference: reference.text,
      threads: shown,
      freshness: session.describeFreshness(syncedAt, warnings),
      format: invocation.format,
      detail: invocation.detail,
    }),
  );
  return 0;
}
