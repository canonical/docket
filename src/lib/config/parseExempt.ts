import checkList from "./checkList.js";
import checkMap from "./checkMap.js";
import checkText from "./checkText.js";
import type { Checked, ConfigError, Exempt } from "./types.js";

/**
 * Reads the `exempt` section: for each metric, the labels that switch it
 * off. Only the close metric takes exemptions.
 */
export default function parseExempt(value: unknown): Checked<Partial<Exempt>> {
  const entries = checkMap(value, "exempt", ["close"]);
  if (!entries.value) return { value: undefined, errors: entries.errors };
  if (!entries.value.has("close")) return { value: {}, errors: entries.errors };
  const labels = checkList(entries.value.get("close"), "exempt.close");
  const errors: ConfigError[] = [...entries.errors, ...labels.errors];
  if (!labels.value) return { value: {}, errors };
  const close: string[] = [];
  for (const label of labels.value) {
    const text = checkText(label, "exempt.close");
    errors.push(...text.errors);
    if (text.value !== undefined) close.push(text.value);
  }
  return { value: { close }, errors };
}
