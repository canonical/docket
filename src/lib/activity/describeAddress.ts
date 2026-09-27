import type { ActivityAddress } from "./types.js";

/**
 * Names an address in activity as its parts, such as `activity`, `24h`
 * then `by kind`. The terminal header and text mode join the same parts,
 * so both name a place alike. The ungrouped list adds no part for its
 * grouping.
 */
export default function describeAddress(address: ActivityAddress): string[] {
  const { amount, unit } = address.window;
  const parts = [address.mode, `${amount}${unit}`];
  return address.grouping === "none"
    ? parts
    : [...parts, `by ${address.grouping}`];
}
