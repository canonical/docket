import type { ThreadDetail } from "../provider/index.js";
import type { ThreadSummary } from "../waits/index.js";
import detailFields from "./detailFields.js";
import fragments from "./fragments.js";
import readThreadDetail, { type DetailNode } from "./readThreadDetail.js";
import splitRepo from "./splitRepo.js";
import type { Client } from "./types.js";

interface Answer {
  readonly [thread: string]: {
    readonly [kind: string]: DetailNode | null | undefined;
  } | null;
}

/**
 * Fetches the details of every thread given in one query, each as
 * `fetchThreadDetail` gives it, in the order given: GitHub charges a
 * query by the lists it could return, so fourteen threads' details cost
 * one point together where they would cost fourteen apart. A thread
 * GitHub no longer finds gives `undefined` in its place.
 *
 * @note Impure: reads from GitHub.
 */
export default async function fetchThreadDetails(
  client: Client,
  threads: readonly ThreadSummary[],
): Promise<(ThreadDetail | undefined)[]> {
  if (threads.length === 0) return [];
  // An alias names each thread, so one query reads them all. Names are
  // written as JSON strings, which GraphQL reads as its own string
  // literals, and a thread's kind is the field GitHub reads it by.
  const fields = threads.map(({ repo, number, kind }, index) => {
    const { owner, name } = splitRepo(repo);
    return `t${index}: repository(owner: ${JSON.stringify(owner)}, name: ${JSON.stringify(name)}) { ${kind}(number: ${number}) { ${detailFields[kind]} } }`;
  });
  const answer = await client.query<Answer>(
    `query Details { ${fragments.rateLimit} ${fields.join(" ")} }`,
    {},
    { allowMissing: true },
  );
  return threads.map(({ kind }, index) => {
    const node = answer[`t${index}`]?.[kind];
    return node ? readThreadDetail(node) : undefined;
  });
}
