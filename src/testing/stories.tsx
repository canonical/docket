/**
 * What docket's stories files share beyond Lago's story types: how a story
 * is drawn on each of the screens in `viewports.ts`.
 */

import type { StoryContext } from "@aztlan/lago-react";
import { cloneElement, isValidElement, type ReactNode } from "react";

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
