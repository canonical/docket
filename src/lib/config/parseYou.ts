import checkList from "./checkList.js";
import checkMap from "./checkMap.js";
import checkText from "./checkText.js";
import formatValue from "./formatValue.js";
import type { Checked, ConfigError, You } from "./types.js";

// The shape `docket review` accepts for a team: an organisation's login,
// a slash, then the team's slug.
const teamShape = /^[A-Za-z0-9](?:-?[A-Za-z0-9]){0,38}\/[A-Za-z0-9][\w-]*$/;

/**
 * Reads the `you` section: what docket cannot read about the person
 * running it, which is the GitHub teams they belong to.
 */
export default function parseYou(value: unknown): Checked<Partial<You>> {
  const entries = checkMap(value, "you", ["teams"]);
  if (!entries.value) return { value: undefined, errors: entries.errors };
  if (!entries.value.has("teams")) return { value: {}, errors: entries.errors };
  const list = checkList(entries.value.get("teams"), "you.teams");
  const errors: ConfigError[] = [...entries.errors, ...list.errors];
  if (!list.value) return { value: {}, errors };
  const teams: string[] = [];
  for (const entry of list.value) {
    const text = checkText(entry, "you.teams");
    errors.push(...text.errors);
    if (text.value === undefined) continue;
    if (teamShape.test(text.value)) {
      teams.push(text.value);
    } else {
      errors.push({
        code: "CONFIG_INVALID_TEAM",
        message: `\`you.teams\` lists \`${formatValue(text.value)}\`, which is not a team written as org/team.`,
        recovery:
          "Write each team as its organisation and its name, such as `example-org/reviewers`.",
      });
    }
  }
  return { value: { teams }, errors };
}
