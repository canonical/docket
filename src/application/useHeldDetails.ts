import { useEffect, useReducer, useState } from "react";
import type { ThreadDetail } from "../lib/provider/index.js";
import type { ThreadSummary } from "../lib/waits/index.js";

/** Props for the useHeldDetails hook. */
export interface UseHeldDetailsProps {
  /**
   * The threads whose details are kept: those the data holds and those on
   * screen. The details of any other thread are let go.
   */
  readonly kept: readonly ThreadSummary[];
  /** The thread selected on the frame drawn last, if any. */
  readonly selected: () => ThreadSummary | undefined;
}

/**
 * Result of the useHeldDetails hook: the details the accordion is given
 * for `thread`, read with `read` unless those held were read at
 * `version`, the thread's last change as the list has it.
 */
export type UseHeldDetailsResult = (
  read: (thread: ThreadSummary) => Promise<ThreadDetail>,
  thread: ThreadSummary,
  version: string,
) => Promise<ThreadDetail>;

/** A thread's repository and number, which no other thread shares. */
const identifyThread = ({ repo, number }: ThreadSummary) => `${repo}#${number}`;

/** What is held of one thread's details. */
interface HeldDetail {
  /** The thread's last change, as the list had it when the read began. */
  readonly version: string;
  /**
   * What the accordion is given: the latest read once it has settled, and
   * until then the details held from before the thread changed, if any.
   */
  shown: Promise<ThreadDetail>;
  /** True once the latest read has failed. */
  failed: boolean;
}

/**
 * Records a read's outcome on its promise, where React's `use` looks for
 * it. A promise `use` has not seen before suspends for a frame even once
 * settled, which would draw `loading…` in place of details already here.
 */
function markSettled(
  reading: Promise<ThreadDetail>,
  outcome:
    | { readonly status: "fulfilled"; readonly value: ThreadDetail }
    | { readonly status: "rejected"; readonly reason: unknown },
): void {
  Object.assign(reading, outcome);
}

/**
 * Holds each thread's details across the copies of the data a refresh
 * brings, so moving the selection back to a thread shows what was read. A
 * thread's details are read again only when its version moves, and the
 * details held from before stay on screen until the new ones settle, so a
 * change never draws `loading…`. A read that failed is read again when the
 * selection comes back to its thread, and never on a frame that keeps the
 * selection there, as the clock's each second does.
 *
 * @note Impure: reads each thread's details through `read`, and redraws
 * once a read settles in place of details already shown.
 */
export default function useHeldDetails({
  kept,
  selected,
}: UseHeldDetailsProps): UseHeldDetailsResult {
  const [details] = useState(() => new Map<string, HeldDetail>());
  const [, showArrived] = useReducer((count: number) => count + 1, 0);
  useEffect(() => {
    const keys = new Set(kept.map(identifyThread));
    for (const key of details.keys()) {
      if (!keys.has(key)) details.delete(key);
    }
  }, [kept, details]);
  return (read, thread, version) => {
    const key = identifyThread(thread);
    const held = details.get(key);
    const chosen = selected();
    const arrived = !chosen || identifyThread(chosen) !== key;
    if (held?.version === version && !(arrived && held.failed)) {
      return held.shown;
    }
    const reading = read(thread);
    const next: HeldDetail = {
      version,
      shown: held && !held.failed ? held.shown : reading,
      failed: false,
    };
    details.set(key, next);
    const settle = (failed: boolean) => {
      next.failed = failed;
      if (details.get(key) !== next || next.shown === reading) return;
      next.shown = reading;
      showArrived();
    };
    reading.then(
      (value) => {
        markSettled(reading, { status: "fulfilled", value });
        settle(false);
      },
      (reason: unknown) => {
        markSettled(reading, { status: "rejected", reason });
        settle(true);
      },
    );
    return next.shown;
  };
}
