import type { KeyEvent, Renderable } from "@opentui/core";
import type { CommandEntry, KeySequencePart } from "@opentui/keymap";
import { keySymbols } from "./constants.js";
import type { KeyCommand } from "./types.js";

/** Shows a key as it is typed: `←` for `left`, `R` for `shift+r`. */
const showKey = (sequence: readonly KeySequencePart[]) =>
  sequence
    .map(({ stroke }) =>
      stroke.shift && stroke.name.length === 1
        ? stroke.name.toUpperCase()
        : (keySymbols[stroke.name] ?? stroke.name),
    )
    .join("");

const readText = (value: unknown) =>
  typeof value === "string" ? value : undefined;

/**
 * Describes the keymap's commands as the help and the key bar show them:
 * each command's label (`desc`), group, key-bar hint and notes, with its
 * keys, or for a command no key runs what it names instead (`shown`).
 * Neighbouring commands with the same label and group share one line,
 * their first keys side by side.
 */
export default function describeCommands(
  entries: readonly CommandEntry<Renderable, KeyEvent>[],
): KeyCommand[] {
  const described: KeyCommand[] = [];
  for (const { command, bindings } of entries) {
    const [first, ...others] = bindings.map(({ sequence }) =>
      showKey(sequence),
    );
    const hint = readText(command.hint);
    // A command no key runs, such as typing into a filter, names what
    // runs it instead.
    const shown = first ?? readText(command.shown);
    const line: KeyCommand = {
      keys: shown === undefined ? [] : [shown],
      alternates: others,
      label: readText(command.desc) ?? command.name,
      ...(hint === undefined ? {} : { hint }),
      group: readText(command.group) ?? "",
      notes: Array.isArray(command.notes) ? command.notes.map(String) : [],
    };
    const last = described.at(-1);
    if (last?.label === line.label && last.group === line.group) {
      described[described.length - 1] = {
        ...last,
        keys: [...last.keys, ...line.keys],
        alternates: [...last.alternates, ...line.alternates],
        notes: [...last.notes, ...line.notes],
      };
    } else {
      described.push(line);
    }
  }
  return described;
}
