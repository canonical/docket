import wrapText from "../../wrapText.js";

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
    (_, command: string) => `run ${command.replaceAll(" ", " ")}`,
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
    reason: wrapText(`✗ ${reason}`, room),
    recovery: wrapText(`Recovery: ${keepCommandsWhole(recovery)}`, room),
  };
}
