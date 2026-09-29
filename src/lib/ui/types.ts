/** A run of a line's text, in its own colour and, when it has one, text attribute. */
export interface Piece {
  readonly text: string;
  readonly fg: string;
  /** OpenTUI's text attribute, such as bold for a row's first line. */
  readonly attributes?: number;
}
