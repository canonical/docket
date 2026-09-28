import type { Checks } from "../waits/index.js";

const states: Readonly<Record<string, Checks>> = {
  SUCCESS: "passing",
  FAILURE: "failing",
  ERROR: "failing",
  PENDING: "running",
  EXPECTED: "running",
};

/**
 * Reads the combined state GitHub gives a commit's checks. It is absent
 * when no check ran on the commit.
 */
export default function readChecks(
  state: string | null | undefined,
): Checks | undefined {
  return state ? states[state] : undefined;
}
