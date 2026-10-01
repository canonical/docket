import fitAccordion from "./fitAccordion.js";
import type { DetailLine } from "./types.js";

/** Room enough that every line is drawn whole, each on one line. */
const wide = 1000;

/**
 * Reads each line's text as the accordion draws it whole, a pending
 * line's dimmed `…` included, a no-break space read as the space it shows.
 */
export default function readTexts(lines: readonly DetailLine[]): string[] {
  return fitAccordion({ body: lines, stack: [] }, wide, wide).map((line) =>
    line
      .map(({ text }) => text)
      .join("")
      .replaceAll("\u00a0", " "),
  );
}
