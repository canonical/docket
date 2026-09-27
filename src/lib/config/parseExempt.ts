import checkList from "./checkList.js";
import checkMap from "./checkMap.js";
import checkText from "./checkText.js";
import type { ConfigError, Exempt } from "./types.js";

/**
 * Reads the `exempt` section: for each metric, the labels that switch it
 * off. Only the close metric takes exemptions.
 */
export default function parseExempt(
  value: unknown,
  errors: ConfigError[],
): Partial<Exempt> | undefined {
  const entries = checkMap(value, "exempt", errors, ["close"]);
  if (!entries) return undefined;
  if (!entries.has("close")) return {};
  const labels = checkList(entries.get("close"), "exempt.close", errors);
  if (!labels) return {};
  return {
    close: labels.flatMap((label) => {
      const text = checkText(label, "exempt.close", errors);
      return text === undefined ? [] : [text];
    }),
  };
}
