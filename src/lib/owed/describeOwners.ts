import { ownerCells } from "./constants.js";
import type { Field, FieldList } from "./types.js";

/** How a row names the people a wait belongs to. */
export interface OwnerFields {
  /** The one owner, or `unassigned`, on the row's second line. */
  readonly owner?: Field;
  /** Every owner on a third line, when there are two or more. */
  readonly owners?: FieldList;
}

/**
 * Names a wait's owners. One owner, or none, fits on the second line.
 * Two or more take a third line that lists every one of them, so the row's
 * height says how many people own it, where a count such as `+1` would
 * hide who they are. Each owner is capped so a long login leaves the
 * title its room.
 */
export default function describeOwners(owners: readonly string[]): OwnerFields {
  const fields = owners.map(
    (text): Field => ({ text, fit: "trimmed", cells: ownerCells }),
  );
  const [only] = fields;
  if (fields.length > 1) return { owners: { fit: "wrapped", fields } };
  return {
    owner: only ?? { text: "unassigned", fit: "trimmed", cells: ownerCells },
  };
}
