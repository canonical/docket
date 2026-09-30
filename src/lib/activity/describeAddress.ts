import type { Header } from "../owed/index.js";
import type { ActivityAddress } from "./types.js";

/**
 * Names an address in activity as a header: the mode as its title, and
 * the window then the grouping, such as `24h · by kind`, as its address.
 * The ungrouped list names its window alone. Text mode joins title and
 * address with ` · `, so both faces name a place alike.
 */
export default function describeAddress(address: ActivityAddress): Header {
  const { amount, unit } = address.window;
  const window = `${amount}${unit}`;
  const text =
    address.grouping === "none" ? window : `${window} · by ${address.grouping}`;
  return {
    title: { text: address.mode, kind: "words" },
    address: { text, kind: "words" },
  };
}
