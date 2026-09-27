import { describeAge } from "../activity/index.js";
import describeTime from "./describeTime.js";
import renderProblems from "./renderProblems.js";
import type { Freshness } from "./types.js";

/**
 * The lines that open an answer: how old its data is, then any warning,
 * such as a rate limit that kept docket from fetching. A person reads
 * `synced 2m ago`; an agent reads the absolute time as well, because it
 * cannot see the reader's clock.
 */
export default function renderFreshness(
  { now, syncedAt, timezone, warnings }: Freshness,
  format: "plain" | "llm",
): string[] {
  const age = syncedAt && describeAge(syncedAt, now);
  const lines = !syncedAt
    ? ["No data: the configuration watches no repository."]
    : format === "llm"
      ? [`Data from ${describeTime(syncedAt, timezone)}, ${age} old.`]
      : [`synced ${age} ago`];
  if (warnings.length === 0) return lines;
  const warned = renderProblems(warnings, format, "Warning").trimEnd();
  return [...lines, "", warned, ""];
}
