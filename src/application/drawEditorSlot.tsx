import type { ReactNode } from "react";
import {
  countPickerLines,
  Notice,
  PeoplePicker,
  wrapNotice,
} from "../lib/ui/index.js";
import { standInIndent } from "./constants.js";
import type { UseEditorResult } from "./useEditor.js";

/** What stands under the selected row in the accordion's place, and how tall it is. */
export interface EditorSlot {
  readonly node: ReactNode;
  readonly lines: number;
}

/**
 * What stands in the accordion's place under the selected row: the open
 * editor, or why a key could not open one, with the lines it takes; and
 * the refusal alone, which stands in for a list with no row.
 *
 * @param width The width of the pane, in display cells.
 */
export default function drawEditorSlot(
  { picker, refusal }: Pick<UseEditorResult, "picker" | "refusal">,
  width: number,
): { readonly refused?: ReactNode; readonly slot?: EditorSlot } {
  const refused = refusal && (
    <Notice reason={refusal.reason} recovery={refusal.recovery} width={width} />
  );
  if (picker) {
    return {
      refused,
      slot: {
        node: <PeoplePicker {...picker} width={width} />,
        lines: countPickerLines({ ...picker, width }),
      },
    };
  }
  if (!refusal) return {};
  const { reason, recovery } = refusal;
  const lines = Object.values(
    wrapNotice(reason, recovery, width - standInIndent),
  ).flat().length;
  return { refused, slot: { node: refused, lines } };
}
