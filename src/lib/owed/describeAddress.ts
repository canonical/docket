import type { Header, OwedAddress } from "./types.js";

/**
 * Names an address in owed as a header: the mode as its title, and the
 * grouping, such as `by owner`, as its address. The ungrouped list has no
 * address. Text mode joins the two with ` · `, so both faces name a place
 * alike.
 */
export default function describeAddress(address: OwedAddress): Header {
  const title = { text: address.mode, fit: "trimmed" } as const;
  return address.grouping === "none"
    ? { title }
    : { title, address: { text: `by ${address.grouping}`, fit: "trimmed" } };
}
