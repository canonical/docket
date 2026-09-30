import type { FieldKind } from "../../owed/index.js";
import type { FitRule } from "./types.js";

/**
 * How each kind of field is fitted to each slot, the one table every
 * block of the terminal fits its text by. A figure is never cut: the
 * slot that holds it leaves it room.
 */
export const fitRules: Readonly<Record<FieldKind, FitRule>> = {
  identifier: { line: "cutEnd", block: "wrap" },
  person: { line: "cutEnd", block: "whole" },
  title: { line: "cutEnd", block: "wrap" },
  quote: { line: "cutEnd", block: "wrap" },
  words: { line: "cutEnd", block: "wrap" },
  reason: { line: "cutEnd", block: "wrap" },
  recovery: { line: "cutEnd", block: "wrap" },
  figure: { line: "whole", block: "whole" },
};
