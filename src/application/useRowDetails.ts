import type { AttentionState, CacheStatus } from "../lib/cache/index.js";
import type { DetailsCount, ShownDetail } from "../lib/ui/index.js";
import type { Thread, ThreadSummary } from "../lib/waits/index.js";
import type { DetailReader } from "./createDetailReader.js";
import describeRowVersion from "./describeRowVersion.js";
import type { ListRow, TerminalView } from "./types.js";
import useHeldDetails from "./useHeldDetails.js";
import useReadAhead from "./useReadAhead.js";

/** Reads one thread's details alone, as the source's `readDetail` does. */
type ReadAlone = Extract<
  TerminalView["source"],
  { readonly cache: unknown }
>["readDetail"];

/** Props for the useRowDetails hook. */
export interface UseRowDetailsProps {
  /** Reads threads' details ahead in batches; without it, none are. */
  readonly reader: DetailReader | undefined;
  /** The list's rows, in the order drawn. */
  readonly rows: readonly ListRow[];
  /** The selected row, if any. */
  readonly selected: ListRow | undefined;
  /** The row selected on the frame drawn last, if any. */
  readonly drawnSelected: () => ListRow | undefined;
  /** The threads the data holds, whose details are kept. */
  readonly held: readonly Thread[];
  /** A row's thread as the data holds it, when it does. */
  readonly findFacts: (row: ListRow) => Thread | undefined;
  readonly attention: AttentionState;
  readonly status: CacheStatus | undefined;
}

/** Result of the useRowDetails hook. */
export interface UseRowDetailsResult {
  /** The details the accordion under `row` is given: read ahead, or alone. */
  readonly readRowDetail: (
    row: ListRow,
    readAlone: ReadAlone,
  ) => Promise<ShownDetail>;
  /** How many of the details asked for are read, while some are not. */
  readonly progress?: DetailsCount;
  /** Drops every thread's details, as a full refresh throws the data away. */
  readonly drop: () => void;
}

/** The thread a row names, in any mode. */
const summarize = (row: ListRow): ThreadSummary =>
  "wait" in row ? row.wait.thread : row.thread;

/**
 * Reads the details of the rows on screen, near the selection first, and
 * gives each row's accordion its own. A finished thread's accordion comes
 * whole from the list, but for a stacked pull request's neighbours, so
 * only those are read ahead, and only while one is selected. A thread's
 * details are read once for each change GitHub records on it or the
 * list's roll-up of its checks shows, as checks finish without a change
 * to the thread; no other copy of the data reads anything. A thread the
 * data does not hold is read once for each newest event its row shows, or
 * its ending, and one gone from the data and the list is let go.
 *
 * @note Impure: reads details from GitHub through `reader` or `readAlone`.
 */
export default function useRowDetails({
  reader,
  rows,
  selected,
  drawnSelected,
  held,
  findFacts,
  attention,
  status,
}: UseRowDetailsProps): UseRowDetailsResult {
  const findVersion = (row: ListRow) => describeRowVersion(row, findFacts(row));
  const detailed = rows.filter((row) => !("ending" in row) || row.stacked);
  const chosen = selected ? detailed.indexOf(selected) : -1;
  const ahead = useReadAhead({
    reader,
    rows: detailed.map((row) => ({
      thread: summarize(row),
      version: findVersion(row),
    })),
    selected: chosen < 0 ? detailed.length : chosen,
    attention,
    paused: status?.paused?.reason,
  });
  const readHeld = useHeldDetails({
    kept: [...held, ...rows.map(summarize)],
    selected: () => {
      const row = drawnSelected();
      return row && summarize(row);
    },
    resumes:
      status?.paused?.reason === "rateLimit" ? status.paused.until : undefined,
  });
  return {
    readRowDetail: (row, readAlone) => {
      const version = findVersion(row);
      const thread = summarize(row);
      return readHeld(
        (each) => (ahead.read ?? readAlone)(each, version),
        thread,
        ahead.version(thread, version),
        findFacts(row),
      );
    },
    ...(ahead.progress && { progress: ahead.progress }),
    drop: ahead.drop,
  };
}
