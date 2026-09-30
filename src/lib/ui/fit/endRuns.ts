import { sanitize } from "../../text/index.js";
import measureText from "./measureText.js";
import trimText from "./trimText.js";

/**
 * Ends the runs of one line with `…` within `width` display cells, to say
 * more follows that is not shown: after the last run when it fits there,
 * or else cutting the run that crosses the width, the runs after it
 * dropped. Each run keeps its own look, so the `…` takes the look of the
 * run it ends. Each run passes through `sanitize`.
 */
export default function endRuns<Run extends { readonly text: string }>(
  runs: readonly Run[],
  width: number,
): Run[] {
  const ended: Run[] = [];
  let room = width - 1;
  for (const run of runs) {
    const text = sanitize(run.text);
    const cells = measureText(text);
    if (cells > room) {
      // The run is cut even when it would end at the width, so the `…`
      // says the runs after it are left out.
      return [...ended, { ...run, text: trimText(`${text}…`, room + 1) }];
    }
    ended.push({ ...run, text });
    room -= cells;
  }
  const last = ended.pop();
  return last ? [...ended, { ...last, text: `${last.text}…` }] : [];
}
