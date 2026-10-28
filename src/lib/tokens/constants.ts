import { RGBA, TextAttributes } from "@opentui/core";
import type { Tokens } from "./types.js";

/**
 * The token values docket draws with: the terminal's own theme colours,
 * named by their ANSI index, and one glyph for each meaning. A colour is
 * always paired with a glyph or a word on screen, so nothing is lost on a
 * terminal that shows it differently: `color.text` and `color.background`
 * are the terminal's default foreground and background, so ordinary text
 * follows the theme, and the rest name the palette's indices — 1 red,
 * 2 green, 3 yellow, 4 blue, 5 magenta, 6 cyan and 8 bright black — which
 * every terminal palette shows in its own hue. The on-track marker takes
 * the same bright black as the muted text: on the selection background,
 * where it would vanish, it stays legible.
 */
export const tokens: Tokens = {
  "color.text": RGBA.defaultForeground(),
  "color.text.muted": RGBA.fromIndex(8),
  "color.text.error": RGBA.fromIndex(1),
  "color.text.warning": RGBA.fromIndex(3),
  "color.text.success": RGBA.fromIndex(2),
  "color.text.team": RGBA.fromIndex(4),
  "color.text.internal": RGBA.fromIndex(5),
  "color.text.outside": RGBA.fromIndex(6),
  "color.border": RGBA.fromIndex(8),
  "color.background": RGBA.defaultBackground(),
  "color.background.selected": RGBA.fromIndex(8),
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
  "glyph.progress.filled": "█",
  "glyph.progress.unfilled": "░",
};
