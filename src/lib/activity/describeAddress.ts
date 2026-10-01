import type { Duration } from "../clock/index.js";
import type { Header } from "../owed/index.js";

/**
 * Names an address in a mode with a window, activity or finished, as a
 * header: the mode as its title, and the window then the grouping, such
 * as `24h · by kind`, as its address.
 * The ungrouped list names its window alone. Text mode joins title and
 * address with ` · `, so both faces name a place alike.
 */
export default function describeAddress(address: {
  readonly mode: string;
  readonly window: Duration;
  readonly grouping: string;
}): Header {
  const { amount, unit } = address.window;
  const window = `${amount}${unit}`;
  const text =
    address.grouping === "none" ? window : `${window} · by ${address.grouping}`;
  return {
    title: { text: address.mode, kind: "words" },
    address: { text, kind: "words" },
  };
}
