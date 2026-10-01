import { wrapNotice } from "../../component/index.js";
import { pickerIndent } from "./constants.js";
import describeOption from "./describeOption.js";
import listShownOptions from "./listShownOptions.js";
import type { PeoplePickerProps } from "./types.js";

/**
 * How many lines the picker takes at `width`: the filter, the lines of
 * the options drawn, a name too long for its line taking more than one
 * (or `loading…`), and the notice's wrapped lines. The list reads
 * it to keep the selected row and its picker whole in view.
 */
export default function countPickerLines({
  options,
  cursor,
  notice,
  width,
}: Pick<PeoplePickerProps, "options" | "cursor" | "notice" | "width">): number {
  const drawn = options
    ? listShownOptions(options, cursor).shown.reduce(
        (lines, option) =>
          lines + describeOption(option, width - pickerIndent).length,
        0,
      )
    : 1;
  const wrapped = notice
    ? wrapNotice(notice.reason, notice.recovery, width - pickerIndent)
    : { reason: [], recovery: [] };
  return 1 + drawn + wrapped.reason.length + wrapped.recovery.length;
}
