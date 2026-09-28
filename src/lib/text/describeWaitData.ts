import type { WaitRow } from "../owed/index.js";
import sanitize from "./sanitize.js";
import type { Detail } from "./types.js";

/**
 * One row as data, for a program: its kind as an identifier (`response`,
 * `review` or `close`), how overdue it is as a share of its target
 * (positive once over, negative while time is left), and times in ISO
 * 8601. The target comes at every level: `overdue` times `target` is the
 * working time past due, or left, which the gap between `due` and the
 * data's time cannot give, since it counts days off too.
 */
export default function describeWaitData(row: WaitRow, detail: Detail) {
  const { thread, owners, due, started, target } = row.wait;
  return {
    reference: row.reference.text,
    title: sanitize(row.title.text),
    kind: row.wait.kind,
    state: row.state,
    overdue: row.overdue,
    owners: owners.map((login) => sanitize(login)),
    due: due.toISOString(),
    draft: row.draft !== undefined,
    checksFailing: thread.checks === "failing",
    stack: thread.stack ?? null,
    target: `${target.amount}${target.unit}`,
    ...(detail === "detailed" ? { started: started.toISOString() } : {}),
  };
}
