import type { RepoProgress } from "../../../cache/index.js";

/** Props for the RefreshStages component. */
export interface RefreshStagesProps {
  /** Each watched repository's stage, in the watched order. */
  stages: readonly RepoProgress[];
  /** The short name of each watched repository, keyed by `owner/name`. */
  names: Readonly<Record<string, string>>;
  /** The width the lines may take, in display cells. */
  width: number;
}
