import { unsupportedMeasures } from "./constants.js";
import type { Coverage, Measure, MeasureKind } from "./types.js";

/**
 * How one kind of measure stands across a list of threads: measured on
 * how many, pending on how many, and how it reads as a whole:
 * unsupported when no provider supplies it, pending while any thread
 * still waits for it, and measured otherwise, an empty list included. A
 * thread it does not apply to is in neither count.
 *
 * @param measures The kind's measure on each thread of the list.
 */
export default function coverMeasures(
  kind: MeasureKind,
  measures: readonly Measure[],
): Coverage {
  const count = (state: Measure["state"]) =>
    measures.filter((measure) => measure.state === state).length;
  const of = count("measured");
  const pending = count("pending");
  if (unsupportedMeasures.has(kind))
    return { state: "unsupported", of, pending };
  return { state: pending > 0 ? "pending" : "measured", of, pending };
}
