/**
 * Waits for an outcome a test can observe, such as a line on the screen or
 * a call, however long the machine takes to reach it.
 */

import { onTestFailed, onTestFinished } from "vitest";

/** The pause between two tries, so the work waited on runs meanwhile. */
const pause = 10;

/**
 * Runs `check` until it stops throwing, and gives what it returned. It
 * keeps no time limit of its own, unlike `vi.waitFor`'s one second: a busy
 * machine only makes it wait longer. An outcome that never comes fails the
 * test at the test's own time limit, which then reports the last try's
 * failure beside its own, and the tries stop with the test.
 */
export async function waitUntil<T>(check: () => T | Promise<T>): Promise<T> {
  let last: unknown;
  let settled = false;
  let ended = false;
  onTestFailed(({ task }) => {
    if (!settled && last instanceof Error) {
      const { name, message, stack } = last;
      task.result?.errors?.push({ name, message, stack });
    }
  });
  onTestFinished(() => {
    ended = true;
  });
  while (!ended) {
    try {
      const outcome = await check();
      settled = true;
      return outcome;
    } catch (failure) {
      last = failure;
      await new Promise((resolve) => setTimeout(resolve, pause));
    }
  }
  throw last;
}
