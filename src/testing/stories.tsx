/**
 * What docket's stories files share beyond Lago's story types: the screens
 * they are drawn on, and how a story is drawn on each.
 */

import type { StoryContext, Viewport } from "@aztlan/lago-react";
import { cloneElement, isValidElement, type ReactNode } from "react";

/** The least the pane allows, and one wider, on the approved frames' 36 lines. */
export const viewports = {
  narrow: { cols: 40, rows: 36 },
  wide: { cols: 60, rows: 36 },
} as const satisfies Record<string, Viewport>;

/** The two screens on fewer lines, for a story that ends sooner. */
export const atHeight = (rows: number) => ({
  narrow: { cols: 40, rows },
  wide: { cols: 60, rows },
});

/** The two screens and one narrower than the pane allows, where it says only that. */
export const withTooNarrow = {
  ...viewports,
  tooNarrow: { cols: 32, rows: 36 },
};

/**
 * `value` with every `width` that equals `from` set to `to`, however deep,
 * inside the elements a story composes too: each block takes its width as
 * a prop, and a story drawn wider gives every block in it the wider width.
 */
function widen(value: unknown, from: number, to: number): unknown {
  if (isValidElement(value)) {
    return cloneElement(
      value,
      widen(value.props, from, to) as Record<string, unknown>,
    );
  }
  if (Array.isArray(value)) return value.map((each) => widen(each, from, to));
  if (
    typeof value === "object" &&
    value !== null &&
    Object.getPrototypeOf(value) === Object.prototype
  ) {
    return Object.fromEntries(
      Object.entries(value).map(([key, each]) => [
        key,
        key === "width" && each === from ? to : widen(each, from, to),
      ]),
    );
  }
  return value;
}

/**
 * How a story of `Component` is drawn on a screen: every block in it as
 * wide as the screen, where the story names its own width.
 */
export function drawAtWidth<Props extends object>(
  Component: (props: Props) => ReactNode,
) {
  return (args: Props, { viewport }: StoryContext<Props>) => {
    const own = (args as { readonly width?: unknown }).width;
    const shown =
      typeof own === "number"
        ? (widen(args, own, viewport.cols) as Props)
        : args;
    return <Component {...shown} />;
  };
}
