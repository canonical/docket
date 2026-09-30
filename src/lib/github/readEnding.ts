import type { Closer, Ending, ThreadAddress } from "../endings/index.js";
import type { ThreadKind } from "../waits/index.js";
import { endingLabels } from "./constants.js";
import readAccount from "./readAccount.js";
import readOutcome from "./readOutcome.js";
import type { ActorNode } from "./types.js";

/** A thread GraphQL names by its number, address and repository. */
interface AddressNode {
  readonly number: number;
  readonly url: string;
  readonly repository: { readonly nameWithOwner: string };
}

/** What closed a thread, as a `ClosedEvent`'s `closer` gives it. */
export type CloserNode =
  | ({ readonly __typename: "PullRequest" } & AddressNode)
  | {
      readonly __typename: "Commit";
      readonly oid: string;
      readonly url: string;
    }
  // GitHub names a project only to a token that may read projects, which
  // gh's is not by default, so a project is known by its type alone.
  | { readonly __typename: "ProjectV2" }
  | null;

/** A thread's latest close, as its timeline gives it. */
export interface CloseNode {
  readonly actor?: ActorNode;
  readonly closer?: CloserNode;
  /**
   * The issue or pull request it duplicates; `null` when there is none,
   * or when the reader may not see it.
   */
  readonly duplicateOf?: AddressNode | null;
}

/** What an issue or a pull request gives of how it stands. */
export interface StateNode {
  /** `OPEN`, `CLOSED`, or `MERGED` for a pull request. */
  readonly state?: string;
  /** Why an issue closed; absent on a pull request. */
  readonly stateReason?: string | null;
  readonly closedAt?: string | null;
  readonly mergedAt?: string | null;
  readonly mergedBy?: ActorNode;
}

const readAddress = (node: AddressNode): ThreadAddress => ({
  repo: node.repository.nameWithOwner,
  number: node.number,
  url: node.url,
});

function readCloser(node: CloserNode | undefined): Closer | undefined {
  switch (node?.__typename) {
    case "PullRequest":
      return { kind: "pullRequest", ...readAddress(node) };
    case "Commit":
      return { kind: "commit", oid: node.oid, url: node.url };
    case "ProjectV2":
      return { kind: "project" };
    default:
      return undefined;
  }
}

/**
 * Reads how a thread ended from its state, never from a pull request's
 * `ClosedEvent`: GitHub records a close beside every merge, and the
 * reason `COMPLETED` on every pull request's close, merged or not. A
 * merge is ended by `mergedBy`; a close by whoever made the thread's
 * latest close, which also says what closed it and what it duplicates.
 * An open thread has no ending.
 *
 * @param close The thread's latest close, when its timeline holds one.
 */
export default function readEnding(
  kind: ThreadKind,
  node: StateNode,
  close: CloseNode | undefined,
): Ending | undefined {
  const merged = node.state === "MERGED";
  const ended = merged
    ? node.mergedAt
    : node.state === "CLOSED" && node.closedAt;
  if (!ended) return undefined;
  if (merged) {
    return {
      outcome: "merged",
      label: endingLabels.merged,
      at: new Date(ended),
      by: readAccount(node.mergedBy ?? null),
    };
  }
  const outcome = readOutcome(kind, node.stateReason);
  const closer = readCloser(close?.closer);
  const duplicate = close?.duplicateOf;
  return {
    outcome,
    label: endingLabels[outcome],
    at: new Date(ended),
    ...(close ? { by: readAccount(close.actor ?? null) } : {}),
    ...(closer ? { closer } : {}),
    ...(duplicate ? { duplicateOf: readAddress(duplicate) } : {}),
  };
}
