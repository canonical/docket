import type { ActivityAddress } from "./types.js";

/**
 * Names an address in activity as its parts, such as `activity` then
 * `24h`. The terminal header and text mode join the same parts, so both
 * name a place alike. The ungrouped list adds no part for its grouping.
 */
export default function describeAddress(address: ActivityAddress): string[] {
  const { amount, unit } = address.window;
  return [address.mode, `${amount}${unit}`];
}
