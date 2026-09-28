import { TextAttributes } from "@opentui/core";
import type { Tokens } from "./types.js";

/**
 * The token values docket draws with: the iceberg theme's dark colours. A
 * colour is always paired with a symbol or a word on screen, so nothing is
 * lost on a terminal that shows it differently.
 */
export const tokens: Tokens = {
  "color.text": "#c6c8d1",
  "color.text.muted": "#6b7089",
  "color.text.error": "#e27878",
  "color.text.warning": "#e2a478",
  "color.text.success": "#b4be82",
  "color.border": "#454b68",
  "color.background": "#161821",
  "color.background.selected": "#2e3244",
  "typography.weight.bold": TextAttributes.BOLD,
};
