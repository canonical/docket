/** Props for the ProgressLine component. */
export interface ProgressLineProps {
  /** How many pages are read, across the repositories begun. */
  fetched: number;
  /**
   * How many pages the repositories begun have: known, and more than 0,
   * once a first page arrives, before which the line is left out.
   */
  total: number;
  /** The width the line may take, in display cells. */
  width: number;
}
