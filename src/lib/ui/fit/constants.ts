import type { FieldKind } from "../../owed/index.js";
import type { FitRule } from "./types.js";

/**
 * How each kind of field is fitted to each slot, the one table every
 * block of the terminal fits its text by. An identifier's end carries its
 * meaning, the number of `example#12` or a branch's last part, so it is
 * cut in its middle. On one line a team drops its `organisation/`, so
 * its own name shows; a block names a person whole, wrapped under itself
 * where it is wider than the block. An event's words with nothing written
 * on GitHub in them, such as `pushed 2 commits`, are cut in their middle,
 * so their end stays; what an event acted on is a field of its own,
 * fitted by its own kind. A figure is never cut: the slot that holds it
 * leaves it room.
 */
export const fitRules: Readonly<Record<FieldKind, FitRule>> = {
  identifier: { line: "cutMiddle", event: "cutMiddle", block: "wrap" },
  person: {
    line: "dropOrganisation",
    event: "dropOrganisation",
    block: "wrap",
  },
  title: { line: "cutEnd", event: "cutEnd", block: "wrap" },
  quote: { line: "cutEnd", event: "cutEnd", block: "wrap" },
  words: { line: "cutEnd", event: "cutMiddle", block: "wrap" },
  reason: { line: "cutEnd", event: "cutEnd", block: "wrap" },
  recovery: { line: "cutEnd", event: "cutEnd", block: "wrap" },
  figure: { line: "whole", event: "whole", block: "whole" },
};

/** Splits text into what a reader sees as one character each. */
export const graphemes = new Intl.Segmenter("en", { granularity: "grapheme" });

/**
 * A space that joins two words so no line breaks between them: a caller
 * puts it between the words of a name or a command it wants kept on one
 * line, and wrapping draws it as an ordinary space.
 */
export const noBreakSpace = "\u00a0";
