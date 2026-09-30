import type { Field } from "../../owed/index.js";
import { sanitize } from "../../text/index.js";
import { fitRules } from "./constants.js";
import cutMiddle from "./cutMiddle.js";
import trimText from "./trimText.js";
import type { LineRule, Slot } from "./types.js";
import wrapText from "./wrapText.js";

/** Fits `text` to one line of `cells` display cells by `rule`. */
function fitLine(text: string, rule: LineRule, cells: number): string {
  switch (rule) {
    case "whole":
      return sanitize(text);
    case "cutMiddle":
      return cutMiddle(text, cells);
    case "dropOrganisation":
      return trimText(text.replace(/^[^/]*\//, ""), cells);
    case "cutEnd":
      return trimText(text, cells);
  }
}

/**
 * Fits `field` to `cells` display cells of `slot` by the rule its kind
 * has there (`fitRules`): one line on a line or an event, the lines it
 * takes in a block. Its text passes through `sanitize` first, so no
 * control sequence reaches the screen, and every width is counted in
 * display cells.
 */
export default function fitField(
  field: Field,
  slot: "line" | "event",
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
  if (slot !== "block") return fitLine(field.text, rule[slot], cells);
  return rule.block === "wrap"
    ? wrapText(field.text, cells)
    : [sanitize(field.text)];
}
