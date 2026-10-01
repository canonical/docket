import type { Exempt } from "../config/index.js";

/**
 * Whether one of a thread's labels takes it off the close clock, as the
 * settings' `exempt.close` lists them. GitHub treats label names that
 * differ only in case as the same label, and so does this.
 */
export default function isExempt(
  labels: readonly string[],
  exempt: Exempt,
): boolean {
  const exempted = new Set(exempt.close.map((label) => label.toLowerCase()));
  return labels.some((label) => exempted.has(label.toLowerCase()));
}
