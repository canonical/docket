import { fitField, noBreakSpace } from "../../fit/index.js";

/** A notice's two parts, each wrapped into the lines it is drawn on. */
export interface WrappedNotice {
  /** The reason, opened with `✗`. */
  readonly reason: readonly string[];
  /** The recovery step, opened with `Recovery:`. */
  readonly recovery: readonly string[];
}

/**
 * Joins the words of each command a step names after `run`, up to a
 * comma or a semicolon, with no-break spaces, so wrapping never splits a
 * command someone will type.
 */
const keepCommandsWhole = (step: string) =>
  step.replace(
    /\brun ([^,;]+)/g,
    (_, command: string) => `run ${command.replaceAll(" ", noBreakSpace)}`,
  );

/**
 * Wraps a notice's reason and recovery into lines of `room` display
 * cells, as the notice draws them, so a block that holds one can count
 * the lines it takes.
 */
export default function wrapNotice(
  reason: string,
  recovery: string,
  room: number,
): WrappedNotice {
  return {
    reason: fitField({ text: `✗ ${reason}`, kind: "reason" }, "block", room),
    recovery: fitField(
      { text: `Recovery: ${keepCommandsWhole(recovery)}`, kind: "recovery" },
      "block",
      room,
    ),
  };
}
