import { shownOptions } from "./constants.js";
import type { PickerOption } from "./types.js";

/**
 * The options drawn, at most five, and the place of the first: the
 * cursor sits in the middle of them where it can, and the last ones fill
 * the lines at the end.
 */
export default function listShownOptions(
  options: readonly PickerOption[],
  cursor: number,
): { readonly first: number; readonly shown: readonly PickerOption[] } {
  const first = Math.max(
    0,
    Math.min(
      cursor - Math.floor(shownOptions / 2),
      options.length - shownOptions,
    ),
  );
  return { first, shown: options.slice(first, first + shownOptions) };
}
