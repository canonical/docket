import { parseDocument } from "yaml";
import checkMap from "./checkMap.js";
import { sectionsByPlace } from "./constants.js";
import parseActivity from "./parseActivity.js";
import parseExempt from "./parseExempt.js";
import parseHosts from "./parseHosts.js";
import parsePeople from "./parsePeople.js";
import parseRepos from "./parseRepos.js";
import parseTargets from "./parseTargets.js";
import parseTime from "./parseTime.js";
import type {
  ConfigError,
  FileOutcome,
  Layer,
  Place,
  Section,
} from "./types.js";

const parsers: {
  readonly [S in Section]: (
    value: unknown,
    errors: ConfigError[],
  ) => Layer[S] | undefined;
} = {
  repos: parseRepos,
  people: parsePeople,
  time: parseTime,
  targets: parseTargets,
  exempt: parseExempt,
  activity: parseActivity,
  hosts: parseHosts,
};

const personalFile = "the personal file";

function readYaml(text: string): { root: unknown } | { errors: ConfigError[] } {
  // Maps become Map objects, so no key can reach an object's prototype,
  // and a key given twice is an error rather than a silent overwrite.
  const document = parseDocument(text, { schema: "core", uniqueKeys: true });
  if (document.errors.length > 0) {
    return {
      errors: document.errors.map((error) => ({
        code:
          error.code === "DUPLICATE_KEY"
            ? "CONFIG_DUPLICATE_KEY"
            : "CONFIG_SYNTAX",
        message: `${error.message.replace(/:?\n[\s\S]*/, "")}.`,
        recovery:
          error.code === "DUPLICATE_KEY"
            ? "Keep one of the two entries for that key."
            : "Correct the YAML at the line and column the message names.",
      })),
    };
  }
  try {
    return { root: document.toJS({ mapAsMap: true }) };
  } catch {
    // Past a fixed number of aliases the parser stops, so a small file
    // cannot expand into an enormous one.
    return {
      errors: [
        {
          code: "CONFIG_SYNTAX",
          message: "The file repeats its aliases too many times to be read.",
          recovery: "Write the repeated values out instead of using aliases.",
        },
      ],
    };
  }
}

/**
 * Reads one configuration file from its text: the personal file or a
 * repository's `.github/docket.yaml`, as `place` says. Every file starts
 * with `version: 1`, and a file with any other version is refused whole.
 *
 * @returns The sections the file declares, or every error it holds, each
 * with the change that fixes it.
 */
export default function parseFile(text: string, place: Place): FileOutcome {
  const read = readYaml(text);
  if ("errors" in read) return { ok: false, errors: read.errors };
  const root = read.root instanceof Map ? read.root : new Map();
  const version: unknown = root.get("version");
  if (version !== 1) {
    return {
      ok: false,
      errors: [
        {
          code: "CONFIG_VERSION",
          message:
            version === undefined
              ? "The file does not say which version it is written in."
              : `The file is version \`${String(version)}\`, and docket reads only version 1.`,
          recovery: "Start the file with `version: 1`.",
        },
      ],
    };
  }
  const errors: ConfigError[] = [];
  // The root is a map, so the check returns one.
  const sections = checkMap(root, "the file", errors, [
    "version",
    ...sectionsByPlace.personal,
  ]) as Map<string, unknown>;
  const layer: Record<string, unknown> = {};
  for (const [key, value] of sections) {
    if (key === "version") continue;
    const section = key as Section;
    if (!sectionsByPlace[place].includes(section)) {
      errors.push({
        code: "CONFIG_SECTION_NOT_ALLOWED",
        message: `A repository file declares \`${section}\`, which only ${personalFile} may declare.`,
        recovery: `Move \`${section}\` to ${personalFile}, or remove it.`,
      });
      continue;
    }
    layer[section] = parsers[section](value, errors);
  }
  return errors.length > 0
    ? { ok: false, errors }
    : { ok: true, layer: layer as Layer };
}
