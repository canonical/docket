/**
 * The terminal's semantic tokens. Each names a meaning on screen, never a
 * colour or a shape, so a theme can change every value without a
 * component noticing. The names follow the design system's tokens
 * wherever the meaning is the same; the people hues, italic and the
 * glyphs are docket's own.
 */
export interface Tokens {
  /** Ordinary text. */
  readonly "color.text": string;
  /**
   * Context rather than action: bots, the stack rule and lines,
   * freshness, key labels.
   */
  readonly "color.text.muted": string;
  /** Over target, a failing field, an error or a refusal. */
  readonly "color.text.error": string;
  /** Due soon. */
  readonly "color.text.warning": string;
  /** The result of an action that succeeded. */
  readonly "color.text.success": string;
  /** The team, and you, behind their marks. */
  readonly "color.text.team": string;
  /** The organisation, not the team, behind its mark. */
  readonly "color.text.internal": string;
  /** Outside the organisation, behind its mark. */
  readonly "color.text.outside": string;
  /** The neutral state marker of a wait on track. */
  readonly "color.border": string;
  /** The pane. */
  readonly "color.background": string;
  /**
   * The selected item, its row and its accordion, and the option under
   * an editor's cursor: the only background on the screen.
   */
  readonly "color.background.selected": string;
  /** A row's first line, as OpenTUI's text attribute, and nothing else. */
  readonly "typography.weight.bold": number;
  /**
   * The title, as OpenTUI's text attribute. Where the font or terminal
   * draws no italic, the title's place on the row still says what it is.
   */
  readonly "typography.style.italic": number;
  /** The item's bar, over target or due soon: heavy, since both want attention. */
  readonly "glyph.bar.attention": string;
  /** The same bar on the item's last line, ending mid-line so the next item reads apart. */
  readonly "glyph.bar.attention.end": string;
  /** The item's bar, on track: light. */
  readonly "glyph.bar.onTrack": string;
  /** The same bar on the item's last line. */
  readonly "glyph.bar.onTrack.end": string;
  /** In a stack, on every line of the item, dashed so it never reads as the bar. */
  readonly "glyph.stack": string;
  /** A section heading's rule, to the pane's edge. */
  readonly "glyph.rule": string;
  /** You, or a GitHub team you belong to, before a login. */
  readonly "glyph.you": string;
  /** The team, before a login. */
  readonly "glyph.team": string;
  /** The organisation, not the team, before a login. */
  readonly "glyph.internal": string;
  /** Outside the organisation, before a login. */
  readonly "glyph.outside": string;
  /** A bot, before its login: not a person. */
  readonly "glyph.bot": string;
  /** Failed: a check, a request, a refresh. */
  readonly "glyph.failed": string;
  /** Your action went through. */
  readonly "glyph.succeeded": string;
  /** In the set, in the picker. */
  readonly "glyph.ticked": string;
  /** Not in the set, in the picker. */
  readonly "glyph.unticked": string;
  /** More rows under the pane. */
  readonly "glyph.below": string;
  /** Trimmed here. */
  readonly "glyph.cut": string;
  /** Separates fields on a line. */
  readonly "glyph.separator": string;
}
