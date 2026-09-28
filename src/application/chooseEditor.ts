import type { Thread } from "../lib/waits/index.js";
import isAssignable from "./isAssignable.js";
import type { SelectedThread } from "./types.js";
import type { WriteAction } from "./writeSet.js";

/** Why a key cannot open its editor, and what to do instead. */
export interface Refusal {
  readonly reason: string;
  readonly recovery: string;
}

/** The thread an editor opens on, or why it does not open. */
export type EditorChoice =
  | { readonly thread: Thread; readonly reference: string }
  | { readonly refusal: Refusal };

/**
 * Whether `a` or `r` can open its editor on the selected thread: assigning
 * takes an issue or a pull request, and requesting review only a pull
 * request. Nothing selected, as on a heading, a stack or an empty list,
 * refuses both, as does a thread that was not open at the last refresh.
 */
export default function chooseEditor(
  action: WriteAction,
  selected: SelectedThread | undefined,
): EditorChoice {
  const key = action === "assign" ? "a" : "r";
  if (!selected) {
    const what =
      action === "assign" ? "no issue or pull request" : "no pull request";
    return {
      refusal: {
        reason: `${what} is selected`,
        recovery: `select one with ↑ ↓, then press ${key}`,
      },
    };
  }
  const { reference, thread } = selected;
  if (!thread) {
    return {
      refusal: {
        reason: `${reference} was not open at the last refresh`,
        recovery: "open it with ⏎ and change it on GitHub",
      },
    };
  }
  if (action === "assign" && !isAssignable(thread)) {
    return {
      refusal: {
        reason: `${reference} is a discussion, and discussions have no assignees`,
        recovery: `select an issue or pull request, then press ${key}`,
      },
    };
  }
  if (action === "review" && thread.kind !== "pullRequest") {
    return {
      refusal: {
        reason: `${reference} is not a pull request, so no review can be requested on it`,
        recovery: `select a pull request, then press ${key}`,
      },
    };
  }
  return { thread, reference };
}
