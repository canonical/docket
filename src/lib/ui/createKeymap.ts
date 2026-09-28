import type { CliRenderer } from "@opentui/core";
import {
  registerDefaultKeys,
  registerEnabledFields,
} from "@opentui/keymap/addons";
import { createOpenTuiKeymap } from "@opentui/keymap/opentui";

/**
 * Creates the keymap the terminal interface binds its keys through: keys
 * written as `shift+r` or `?`, and an `enabled` field that turns a command
 * off, such as the time window outside activity. Each command also
 * carries what the help and the key bar show of it, read back by
 * `useCommands`: `desc`, `group`, `hint`, `notes`, and `shown` for a
 * command no key runs.
 *
 * @note Impure: listens to the renderer's keys until the renderer ends.
 */
export default function createKeymap(renderer: CliRenderer) {
  const keymap = createOpenTuiKeymap(renderer);
  registerDefaultKeys(keymap);
  registerEnabledFields(keymap);
  return keymap;
}
