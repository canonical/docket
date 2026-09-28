import type { Account } from "../people/index.js";
import type { CheckDetail } from "../provider/index.js";
import readAccount from "./readAccount.js";
import type { CheckNode } from "./types.js";

/** A check, when it finished, and the account that ran it. */
export interface ReadCheck extends CheckDetail {
  /** When a finished check finished, or when a commit status was set. */
  readonly at: Date | undefined;
  readonly actor: Account;
}

/** The conclusions of a finished check run that count as passing. */
const passed = new Set(["SUCCESS", "NEUTRAL", "SKIPPED"]);

/**
 * Reads one check on a commit: a check run, run by a GitHub App, or a
 * commit status, set by an account. A check run that has not finished is
 * running, and so is a status still pending.
 */
export default function readCheck(node: CheckNode): ReadCheck {
  if (node.__typename === "CheckRun") {
    const app = node.checkSuite.app;
    return {
      name: node.name,
      state:
        node.status !== "COMPLETED"
          ? "running"
          : passed.has(node.conclusion ?? "")
            ? "passing"
            : "failing",
      at: node.completedAt ? new Date(node.completedAt) : undefined,
      actor: app ? { login: app.slug, type: "bot" } : readAccount(null),
    };
  }
  return {
    name: node.context,
    state:
      node.state === "SUCCESS"
        ? "passing"
        : ["PENDING", "EXPECTED"].includes(node.state)
          ? "running"
          : "failing",
    at: new Date(node.createdAt),
    actor: readAccount(node.creator),
  };
}
