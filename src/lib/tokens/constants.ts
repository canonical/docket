import { TextAttributes } from "@opentui/core";
import type { Tokens } from "./types.js";

/**
 * The token values docket draws with: the iceberg theme's dark colours,
 * and one glyph for each meaning. A colour is always paired with a glyph
 * or a word on screen, so nothing is lost on a terminal that shows it
 * differently. The on-track marker takes the theme's base04: base11
 * measures 1.49:1 on the selection background, where it would vanish.
 */
export const tokens: Tokens = {
  "color.text": "#c6c8d1",
  "color.text.muted": "#6b7089",
  "color.text.error": "#e27878",
  "color.text.warning": "#e2a478",
  "color.text.success": "#b4be82",
  "color.text.team": "#84a0c6",
  "color.text.internal": "#a093c7",
  "color.text.outside": "#89b8c2",
  "color.border": "#818596",
  "color.background": "#161821",
  "color.background.selected": "#2e3244",
  "typography.weight.bold": TextAttributes.BOLD,
  "typography.style.italic": TextAttributes.ITALIC,
  "glyph.bar.attention": "┃",
  "glyph.bar.attention.end": "╹",
  "glyph.bar.onTrack": "│",
  "glyph.bar.onTrack.end": "╵",
  "glyph.stack": "┆",
  "glyph.rule": "─",
  "glyph.you": "◉",
  "glyph.team": "●",
  "glyph.internal": "◐",
  "glyph.outside": "○",
  "glyph.bot": "■",
  "glyph.failed": "✗",
  "glyph.succeeded": "✓",
  "glyph.ticked": "☑",
  "glyph.unticked": "☐",
  "glyph.below": "↓",
  "glyph.cut": "…",
  "glyph.separator": "·",
};
