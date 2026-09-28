/**
 * The terminal's semantic tokens. Each names a meaning on screen, never a
 * colour, so a theme can change every value without a component noticing.
 * The names follow the design system's tokens wherever the meaning is the
 * same.
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
  /** The neutral state marker of a wait on track. */
  readonly "color.border": string;
  /** The pane. */
  readonly "color.background": string;
  /** The selected row: the only background on the screen. */
  readonly "color.background.selected": string;
  /** The mode name, headings and keys, as OpenTUI's text attribute. */
  readonly "typography.weight.bold": number;
}
