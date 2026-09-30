import type { Field } from "../../owed/index.js";
import { sanitize } from "../../text/index.js";
import { fitRules } from "./constants.js";
import cutMiddle from "./cutMiddle.js";
import trimText from "./trimText.js";
import type { Slot } from "./types.js";
import wrapText from "./wrapText.js";

/**
 * Fits `field` to `cells` display cells of `slot` by the rule its kind
 * has there (`fitRules`): one line on a line, the lines it takes in a
 * block. Its text passes through `sanitize` first, so no control
 * sequence reaches the screen, and every width is counted in display
 * cells.
 */
export default function fitField(
  field: Field,
  slot: "line",
  cells: number,
): string;
export default function fitField(
  field: Field,
  slot: "block",
  cells: number,
): string[];
export default function fitField(
  field: Field,
  slot: Slot,
  cells: number,
): string | string[] {
  const rule = fitRules[field.kind];
  if (slot === "line") {
    switch (rule.line) {
      case "whole":
        return sanitize(field.text);
      case "cutMiddle":
        return cutMiddle(field.text, cells);
      case "dropOrganisation":
        return trimText(field.text.replace(/^[^/]*\//, ""), cells);
      case "cutEnd":
        return trimText(field.text, cells);
    }
  }
  return rule.block === "wrap"
    ? wrapText(field.text, cells)
    : [sanitize(field.text)];
}
