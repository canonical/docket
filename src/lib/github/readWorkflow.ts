import type { InboxWorkflow } from "../inbox/index.js";

const workflowTitle =
  /^(.*) workflow run (failed|succeeded|cancelled|timed out) for (.*) branch$/i;

/**
 * Reads the workflow and branch from a GitHub Actions notification's
 * title, as in `CI workflow run failed for main branch`, and whether the
 * run failed.
 */
export default function readWorkflow(title: string): InboxWorkflow | undefined {
  const found = title.match(workflowTitle);
  if (!found) return undefined;
  const [, name, outcome, branch] = found;
  return {
    name,
    branch,
    failed: ["failed", "timed out"].includes(outcome.toLowerCase()),
  };
}
