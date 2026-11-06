import checkText from "./checkText.js";
import { viewModes } from "./constants.js";
import formatValue from "./formatValue.js";
import type { Checked, ConfigError, View } from "./types.js";

/**
 * Reads the `start` section: the mode `docket` alone opens on in the
 * terminal interface.
 */
export default function parseStart(value: unknown): Checked<View> {
  const text = checkText(value, "start");
  if (text.value === undefined)
    return { value: undefined, errors: text.errors };
  const view = viewModes.find((entry) => entry === text.value);
  if (!view) {
    const errors: ConfigError[] = [
      {
        code: "CONFIG_UNKNOWN_VIEW",
        message: `\`start\` is \`${formatValue(text.value)}\`, which is not a view.`,
        recovery: "Write one of `owed`, `activity`, `finished` or `inbox`.",
      },
    ];
    return { value: undefined, errors };
  }
  return { value: view, errors: text.errors };
}
