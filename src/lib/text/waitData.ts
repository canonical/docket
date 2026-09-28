import type { WaitRow } from "../owed/index.js";
import sanitize from "./sanitize.js";
import type { Detail } from "./types.js";

/** One row as data, for a program: times in ISO 8601. */
export default function waitData(row: WaitRow, detail: Detail) {
  const { thread, owners, due, started, target } = row.wait;
  return {
    reference: row.reference.text,
    title: sanitize(row.title.text),
    kind: row.kind.text,
    state: row.state,
    distance: row.distance.text,
    owners: owners.map((login) => sanitize(login)),
    due: due.toISOString(),
    draft: row.draft !== undefined,
    checksFailing: thread.checks === "failing",
    stack: thread.stack ?? null,
    ...(detail === "detailed"
      ? {
          started: started.toISOString(),
          target: `${target.amount}${target.unit}`,
        }
      : {}),
  };
}
