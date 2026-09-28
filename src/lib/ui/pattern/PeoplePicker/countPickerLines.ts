import { wrapNotice } from "../../component/index.js";
import { pickerIndent, shownOptions } from "./constants.js";
import type { PeoplePickerProps } from "./types.js";

/**
 * How many lines the picker takes at `width`: the filter, the options
 * drawn (or `loading…`), and the notice's wrapped lines. The list reads
 * it to keep the selected row and its picker whole in view.
 */
export default function countPickerLines({
  options,
  notice,
  width,
}: Pick<PeoplePickerProps, "options" | "notice" | "width">): number {
  const drawn = options ? Math.min(options.length, shownOptions) : 1;
  const wrapped = notice
    ? wrapNotice(notice.reason, notice.recovery, width - pickerIndent)
    : { reason: [], recovery: [] };
  return 1 + drawn + wrapped.reason.length + wrapped.recovery.length;
}
