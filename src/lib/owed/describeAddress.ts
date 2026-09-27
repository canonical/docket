import type { OwedAddress } from "./types.js";

/**
 * Names an address in owed as its parts, such as `owed`. The terminal
 * header and text mode join the same parts, so both name a place alike.
 * The ungrouped list adds no part to its mode.
 */
export default function describeAddress(address: OwedAddress): string[] {
  return [address.mode];
}
