import type { ThreadDetail } from "../lib/provider/index.js";
import type { ThreadSummary } from "../lib/waits/index.js";
import type { DetailReader } from "./createDetailReader.js";
import identifyThread from "./identifyThread.js";

/**
 * Reads the selected thread's details through `reader`, which reads it
 * even below the budget floor.
 *
 * @note Impure: reads through `reader`.
 * @throws Error when the provider no longer finds the thread.
 */
export default async function readOneDetail(
  reader: Pick<DetailReader, "read">,
  thread: ThreadSummary,
): Promise<ThreadDetail> {
  const [read] = await reader.read([thread], thread);
  if (!read?.detail)
    throw new Error(`${identifyThread(thread)} was not found.`);
  return read.detail;
}
