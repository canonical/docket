/** Props for the ProgressLine component. */
export interface ProgressLineProps {
  /** How many pages are read, across the repositories begun. */
  fetched: number;
  /**
   * How many pages the repositories begun have, or 0 before the first
   * arrives.
   */
  total: number;
  /** The width the line may take, in display cells. */
  width: number;
}
