import { useEffect, useReducer, useState } from "react";
import type { ThreadDetail } from "../lib/provider/index.js";
import type { ShownDetail } from "../lib/ui/index.js";
import type { Thread, ThreadSummary } from "../lib/waits/index.js";
import composeDetail from "./composeDetail.js";

/** Props for the useHeldDetails hook. */
export interface UseHeldDetailsProps {
  /**
   * The threads whose details are kept: those the data holds and those on
   * screen. The details of any other thread are let go.
   */
  readonly kept: readonly ThreadSummary[];
  /** The thread selected on the frame drawn last, if any. */
  readonly selected: () => ThreadSummary | undefined;
  /**
   * When reading resumes, while it is paused, below the budget floor or
   * under the rate limit, when no read may spend a point: the details held
   * are given whatever their version, and nothing is read.
   */
  readonly resumes?: Date;
}

/**
 * Result of the useHeldDetails hook: the details the accordion is given
 * for `thread`, read with `read` unless those held were read at
 * `version`, what the list shows of the thread's last change. `facts` is
 * the thread as the snapshot holds it, if it does, which stands in while
 * reading is paused.
 */
export type UseHeldDetailsResult = (
  read: (thread: ThreadSummary) => Promise<ThreadDetail>,
  thread: ThreadSummary,
  version: string,
  facts?: Thread,
) => Promise<ShownDetail>;

/** A thread's repository and number, which no other thread shares. */
const identifyThread = ({ repo, number }: ThreadSummary) => `${repo}#${number}`;

/** What is held of one thread's details. */
interface HeldDetail {
  /**
   * The thread's version, as the list had it when the read began, or none
   * when nothing has been read, only what the snapshot holds given.
   */
  readonly version: string | undefined;
  /**
   * What the accordion is given: the latest read once it has settled, and
   * until then the details held from before the thread changed, or what
   * the snapshot holds, if any.
   */
  shown: Promise<ShownDetail>;
  /** True once the latest read has failed. */
  failed: boolean;
  /**
   * True while `shown` is what the snapshot holds, given while reading was
   * paused, which stays on screen until the latest read settles.
   */
  standingIn: boolean;
}

/**
 * Records a read's outcome on its promise, where React's `use` looks for
 * it. A promise `use` has not seen before suspends for a frame even once
 * settled, which would draw `loading…` in place of details already here.
 */
function markSettled(
  reading: Promise<ShownDetail>,
  outcome:
    | { readonly status: "fulfilled"; readonly value: ShownDetail }
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
 * While reading is paused nothing is read, and the details held stay on
 * screen whatever the thread's version, once they have settled. A thread
 * with none settled is given, settled at once, what the snapshot holds of
 * it, or, when it holds nothing, when reading resumes, so the accordion
 * never waits on a read that cannot start. What it is given stays on
 * screen once reading resumes, until the read settles.
 *
 * @note Impure: reads each thread's details through `read`, and redraws
 * once a read settles in place of details already shown.
 */
export default function useHeldDetails({
  kept,
  selected,
  resumes,
}: UseHeldDetailsProps): UseHeldDetailsResult {
  const [details] = useState(() => new Map<string, HeldDetail>());
  const [, showArrived] = useReducer((count: number) => count + 1, 0);
  useEffect(() => {
    const keys = new Set(kept.map(identifyThread));
    for (const key of details.keys()) {
      if (!keys.has(key)) details.delete(key);
    }
  }, [kept, details]);
  return (read, thread, version, facts) => {
    const key = identifyThread(thread);
    const held = details.get(key);
    const chosen = selected();
    const arrived = !chosen || identifyThread(chosen) !== key;
    if (resumes) {
      // A read queued but not yet sent when the pause began stays unsent
      // until reading resumes, so only details already settled are given.
      // The read stays held, and is sent once reading resumes.
      if (held && !held.standingIn && "status" in held.shown) {
        return held.shown;
      }
      const value = facts ? composeDetail(facts) : { resumes };
      const standIn = Promise.resolve(value);
      markSettled(standIn, { status: "fulfilled", value });
      // Held, so it stays on screen once reading resumes until the read
      // settles: nothing that was shown gives way to `loading…`.
      if (held) {
        held.shown = standIn;
        held.standingIn = true;
      } else {
        details.set(key, {
          version: undefined,
          shown: standIn,
          failed: false,
          standingIn: true,
        });
      }
      return standIn;
    }
    if (held?.version === version && !(arrived && held.failed)) {
      return held.shown;
    }
    const reading = read(thread);
    // The details held from before the thread changed, or what the
    // snapshot holds, stay on screen until the new ones settle, so a change
    // never draws `loading…` over details already shown. After a failed
    // read nothing is held, and the read draws `loading…` until it settles.
    const next: HeldDetail = {
      version,
      shown: held && !held.failed ? held.shown : reading,
      failed: false,
      standingIn: held?.standingIn ?? false,
    };
    details.set(key, next);
    const settle = (failed: boolean) => {
      next.failed = failed;
      if (details.get(key) !== next || next.shown === reading) return;
      next.shown = reading;
      next.standingIn = false;
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
