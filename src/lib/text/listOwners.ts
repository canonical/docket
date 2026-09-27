import type { Field, FieldList } from "../owed/index.js";
import sanitize from "./sanitize.js";

/**
 * The owners a row names, each whole: the one owner, `unassigned`, or
 * every owner when two or more take a line of their own. Logins come from
 * GitHub, so each is made safe to print.
 */
export default function listOwners(row: {
  readonly owner?: Field;
  readonly owners?: FieldList;
}): string[] {
  const fields = row.owners?.fields ?? (row.owner ? [row.owner] : []);
  return fields.map(({ text }) => sanitize(text));
}
