/** Props for the ProgressLine component. */
export interface ProgressLineProps {
  /** How many pages are fetched. */
  fetched: number;
  /** How many pages there are, or 0 before the first arrives. */
  total: number;
  /** The width the line may take, in display cells. */
  width: number;
}
