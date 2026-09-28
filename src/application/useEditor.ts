import { useBindings } from "@opentui/keymap/react";
import { useRef, useState } from "react";
import type { ActionResult, PeoplePickerProps } from "../lib/ui/index.js";
import type { Thread } from "../lib/waits/index.js";
import chooseEditor, { type Refusal } from "./chooseEditor.js";
import describeFailure from "./describeFailure.js";
import listCandidates from "./listCandidates.js";
import type { SelectedThread, TerminalView } from "./types.js";
import type { WriteAction, WriteOutcome } from "./writeSet.js";

/** What the editor reads and writes through: the view's source, once connected. */
type EditorSource = Pick<
  Extract<TerminalView["source"], { readonly cache: unknown }>,
  "readCandidates" | "write"
>;

/** Props for the useEditor hook. */
export interface UseEditorProps {
  /** Where the editor reads and writes, or none while gh gives no token. */
  readonly source: EditorSource | undefined;
  /** The logins `repo` groups as its team, which assigning offers first. */
  readonly findTeam: (repo: string) => readonly string[];
  /** The current time, which dates an action's result. */
  readonly now: () => Date;
  /** Shows the result of applying, or of a refused key, on the status line. */
  readonly onResult: (result: ActionResult) => void;
  /**
   * True while the help covers the editor, or the pane is too narrow to
   * draw it, which turns its keys off, so none acts on what is out of
   * sight.
   */
  readonly covered: boolean;
}

/** Result of the useEditor hook. */
export interface UseEditorResult {
  /** Whether an editor is open, which turns the other keys off. */
  readonly open: boolean;
  /** The header's title while an editor is open: `assigning example#12`. */
  readonly title?: string;
  /** The picker to draw under the selected row while an editor is open. */
  readonly picker?: Omit<PeoplePickerProps, "width">;
  /** Why the last `a` or `r` did not open, while the selection stays put. */
  readonly refusal?: Refusal;
  /** Opens the editor for `action` on `selected`, or says why it cannot. */
  readonly start: (
    action: WriteAction,
    selected: SelectedThread | undefined,
  ) => void;
  /**
   * Hears the reference of the row selected on each frame, or none: an
   * editor belongs to its row, and a refusal to the selection it was
   * refused on, so either goes once the selection moves off, as when a
   * refresh drops the row.
   */
  readonly follow: (selected: string | undefined) => void;
}

/** An open editor. */
interface Editing {
  readonly action: WriteAction;
  readonly thread: Thread;
  readonly reference: string;
  readonly filter: string;
  /** The place of the cursor among the options the filter leaves. */
  readonly cursor: number;
  /** The names applying sets, in lower case: GitHub ignores case in them. */
  readonly ticked: ReadonlySet<string>;
  /** Everyone offered, in order; none while GitHub is read. */
  readonly names?: readonly string[];
  /**
   * True once GitHub could not give whom to offer or the set it holds:
   * with nothing read to apply, applying would empty the set.
   */
  readonly unread?: true;
  /** Why GitHub refused, or could not be read. */
  readonly notice?: Refusal;
  /** True while a change is being written, so it is sent once. */
  readonly writing: boolean;
}

/** A key's refusal, and the selection it was refused on. */
interface Refused extends Refusal {
  readonly selected: string | undefined;
}

const titles = { assign: "assigning", review: "requesting review" } as const;

/** The key that opens each editor. */
const keys = { assign: "a", review: "r" } as const;

/** A notice's reason is a line on screen, which ends without a full stop. */
const dropFullStop = (sentence: string) => sentence.replace(/\.$/, "");

/** The options the filter leaves, ignoring case, each with its tick. */
const listOptions = ({ names, filter, ticked }: Editing) =>
  names
    ?.filter((name) => name.toLowerCase().includes(filter.toLowerCase()))
    .map((name) => ({ name, ticked: ticked.has(name.toLowerCase()) }));

/** What the status line says once a set is written. */
function describeApplied(action: WriteAction, applied: readonly string[]) {
  const names = applied.join(", ");
  if (action === "assign") return names ? `assigned ${names}` : "unassigned";
  return names ? `requested review from ${names}` : "no review requested";
}

/** The help's and the key bar's line for typing, which no key runs. */
const typeToFilter = () => {};

/**
 * The editor that `a` and `r` open under the selected row: its state,
 * the reading of whom it offers, its keys and the write it applies. Its
 * keys sit in their own layer, which acts while an editor is open and the
 * help does not cover it: typing filters, the arrows move, `␣` ticks or unticks, `⏎` applies the whole
 * set and `esc` cancels. The layer stays registered while no editor is
 * open, so the help lists its keys.
 *
 * @note Impure: reads GitHub when an editor opens, and writes to it when
 * one applies.
 */
export default function useEditor({
  source,
  findTeam,
  now,
  onResult,
  covered,
}: UseEditorProps): UseEditorResult {
  const [editing, setEditing] = useState<Editing>();
  const [refused, setRefused] = useState<Refused>();
  // Each opening is numbered, so a reading, or the answer to a write,
  // that arrives after another editor opened never reaches it.
  const opened = useRef(0);
  const current = useRef(editing);
  current.current = editing;
  // The keys run closures made when their layer was bound, so they read
  // the props of the latest frame, never those of the frame that bound them.
  const latest = useRef({ source, findTeam, now, onResult });
  latest.current = { source, findTeam, now, onResult };

  const follow = (selected: string | undefined) => {
    setEditing((editor) =>
      editor?.reference === selected ? editor : undefined,
    );
    setRefused((refusal) =>
      refusal?.selected === selected ? refusal : undefined,
    );
  };

  const start = (action: WriteAction, selected: SelectedThread | undefined) => {
    const { source, findTeam, now, onResult } = latest.current;
    const choice = chooseEditor(action, selected);
    if ("refusal" in choice) {
      setRefused({ ...choice.refusal, selected: selected?.reference });
      onResult({ failed: true, text: `${action} refused`, at: now() });
      return;
    }
    if (!source) return;
    const { thread, reference } = choice;
    setRefused(undefined);
    const opening = ++opened.current;
    setEditing({
      action,
      thread,
      reference,
      filter: "",
      cursor: 0,
      ticked: new Set(),
      writing: false,
    });
    const update = (change: (editor: Editing) => Editing) =>
      opening === opened.current &&
      setEditing((editor) => editor && change(editor));
    source.readCandidates(action, thread).then(
      (candidates) => {
        const team = findTeam(thread.repo);
        const names = listCandidates({ action, thread, team, candidates });
        const ticked = new Set(
          candidates.current.map((name) => name.toLowerCase()),
        );
        update((editor) => ({ ...editor, names, ticked }));
      },
      (error: unknown) => {
        const { message, recovery } = describeFailure(error);
        // `R` is off while an editor is open, so trying again closes it.
        const retry = `close the editor with esc, refresh with R, then open it again with ${keys[action]}`;
        const notice = {
          reason: dropFullStop(message),
          recovery:
            error instanceof Error &&
            "step" in error &&
            typeof error.step === "string"
              ? `${error.step}, then ${retry}`
              : recovery,
        };
        update((editor) => ({ ...editor, names: [], unread: true, notice }));
      },
    );
  };

  // Within the options the filter leaves, never past either end.
  const move = (step: number) =>
    setEditing(
      (editor) =>
        editor && {
          ...editor,
          cursor: Math.max(
            0,
            Math.min(
              editor.cursor + step,
              (listOptions(editor)?.length ?? 0) - 1,
            ),
          ),
        },
    );

  const toggle = () =>
    setEditing((editor) => {
      const option = editor && listOptions(editor)?.at(editor.cursor);
      if (!editor || !option) return editor;
      const ticked = new Set(editor.ticked);
      const key = option.name.toLowerCase();
      if (!ticked.delete(key)) ticked.add(key);
      return { ...editor, ticked };
    });

  const apply = async () => {
    const { source, now, onResult } = latest.current;
    const editor = current.current;
    if (!source || !editor?.names || editor.unread || editor.writing) return;
    const { action, thread, reference, names, ticked } = editor;
    const wanted = names.filter((name) => ticked.has(name.toLowerCase()));
    // A write outlives its editor once another opens, so its answer then
    // tells only the status line, never the editor open since.
    const opening = opened.current;
    const update = (
      change: (open: Editing | undefined) => Editing | undefined,
    ) => opening === opened.current && setEditing(change);
    const refuse = (notice: Refusal) => {
      update((open) => open && { ...open, notice, writing: false });
      onResult({ failed: true, text: `${action} refused`, at: now() });
    };
    setEditing({ ...editor, writing: true });
    let outcome: WriteOutcome;
    try {
      outcome = await source.write({ action, thread, reference, wanted });
    } catch (error) {
      const { message, recovery } = describeFailure(error);
      refuse({ reason: dropFullStop(message), recovery });
      return;
    }
    const { applied, shortfall } = outcome;
    if (shortfall) {
      const { message, recovery } = shortfall;
      refuse({ reason: dropFullStop(message), recovery });
      return;
    }
    update(() => undefined);
    if (applied) {
      onResult({
        failed: false,
        text: describeApplied(action, applied),
        at: now(),
      });
    }
  };

  const open = editing !== undefined;
  useBindings(
    () => ({
      // Above the global layer, so the key bar lists the editor's keys first.
      priority: 1,
      commands: [
        {
          name: "editor.filter",
          desc: "filter",
          group: "Editor",
          hint: "filter",
          shown: "type",
          run: typeToFilter,
        },
        {
          name: "editor.previous",
          desc: "move",
          group: "Editor",
          hint: "",
          run: () => move(-1),
        },
        {
          name: "editor.next",
          desc: "move",
          group: "Editor",
          hint: "",
          run: () => move(1),
        },
        {
          name: "editor.toggle",
          desc: "toggle",
          group: "Editor",
          hint: "tick",
          run: toggle,
        },
        {
          name: "editor.apply",
          desc: "apply",
          group: "Editor",
          hint: "apply",
          run: () => void apply(),
        },
        {
          name: "editor.cancel",
          desc: "cancel",
          group: "Editor",
          hint: "",
          run: () => setEditing(undefined),
        },
        // On exactly while an editor is open and in sight, never by the
        // focus: the filter is drawn anew after the help, or after a pane
        // too narrow for it, and the keys outlast it.
      ].map((command) => ({ ...command, enabled: open && !covered })),
      bindings: [
        { key: "up", cmd: "editor.previous" },
        { key: "down", cmd: "editor.next" },
        { key: "space", cmd: "editor.toggle" },
        { key: "return", cmd: "editor.apply" },
        { key: "escape", cmd: "editor.cancel" },
      ],
    }),
    [open, covered],
  );

  if (!editing) {
    return {
      open: false,
      start,
      follow,
      ...(refused && { refusal: refused }),
    };
  }
  const options = listOptions(editing);
  return {
    open: true,
    title: `${titles[editing.action]} ${editing.reference}`,
    picker: {
      filter: editing.filter,
      onFilter: (filter) =>
        setEditing((editor) => editor && { ...editor, filter, cursor: 0 }),
      ...(options && { options }),
      cursor: editing.cursor,
      ...(editing.notice && { notice: editing.notice }),
    },
    start,
    follow,
  };
}
