import { issueNode, noFile, probe, snapshot } from "./shapes.js";

const repo = "example-org/example-repo";

/** An issue bob opened at `createdAt`, waiting for a reply. */
const opened = (number: number, createdAt: string) =>
  issueNode({ number, title: `Opened ${createdAt}`, createdAt, author: "bob" });

/**
 * Issues opened at instants chosen around weekends and clock changes:
 * Friday 16:00 in Paris; Friday 16:00 in Paris before the clocks go back;
 * Friday 16:00 in New York before the clocks go forward; and an instant
 * that is Saturday in Paris but still Friday in New York.
 */
export default {
  [`File ${repo}`]: noFile,
  [`GET /repos/${repo}/issues`]: probe("clock"),
  [`Snapshot ${repo}`]: snapshot([
    opened(1, "2026-09-25T14:00:00Z"),
    opened(2, "2026-10-23T14:00:00Z"),
    opened(3, "2027-03-12T21:00:00Z"),
    opened(4, "2026-09-26T02:00:00Z"),
  ]),
};
