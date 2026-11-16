/**
 * The screens docket's stories are drawn on. Plain data, so the vitest
 * configuration reads them without loading React.
 */

import type { Viewport } from "@aztlan/lago-react";

/** The least the pane allows, and one wider, on the approved frames' 36 lines. */
export const viewports = {
  narrow: { cols: 40, rows: 36 },
  wide: { cols: 60, rows: 36 },
} as const satisfies Record<string, Viewport>;

/** The two screens on fewer lines, for a story that ends sooner. */
export const atHeight = (rows: number) =>
  Object.fromEntries(Object.keys(viewports).map((name) => [name, { rows }]));

/** A screen narrower than the pane allows, where it says only that, drawn beside the two. */
export const withTooNarrow = {
  tooNarrow: { cols: 32, rows: 36 },
} as const satisfies Record<string, Viewport>;
