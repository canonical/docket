import checkList from "./checkList.js";
import checkMap from "./checkMap.js";
import checkText from "./checkText.js";
import type { Checked, ConfigError, Repo } from "./types.js";

// A short name is written before `#` in a thread reference, as in `ds#88`.
const shortName = /^[A-Za-z0-9._-]+$/;
const ownerAndName = /^[A-Za-z0-9-]+\/[A-Za-z0-9._-]+$/;

function parseRepo(name: string, value: unknown): Checked<Repo> {
  const path = `repos.${name}`;
  const entries = checkMap(value, path, ["repo", "tags"]);
  if (!entries.value) return { value: undefined, errors: entries.errors };
  const errors: ConfigError[] = [...entries.errors];
  const repo = entries.value.get("repo");
  if (typeof repo !== "string" || !ownerAndName.test(repo)) {
    errors.push({
      code: "CONFIG_INVALID_REPO",
      message: `\`${path}.repo\` is \`${String(repo)}\`, which is not a repository written as owner/name.`,
      recovery: `Write \`repo: owner/name\` under \`${path}\`, such as \`repo: example-org/example-repo\`.`,
    });
    return { value: undefined, errors };
  }
  const tags: string[] = [];
  if (entries.value.has("tags")) {
    const list = checkList(entries.value.get("tags"), `${path}.tags`);
    errors.push(...list.errors);
    for (const tag of list.value ?? []) {
      const text = checkText(tag, `${path}.tags`);
      errors.push(...text.errors);
      if (text.value !== undefined) tags.push(text.value);
    }
  }
  return { value: { name, repo, tags }, errors };
}

/** Reads the `repos` section: each short name and its repository. */
export default function parseRepos(value: unknown): Checked<Repo[]> {
  const entries = checkMap(value, "repos");
  if (!entries.value) return { value: undefined, errors: entries.errors };
  const errors: ConfigError[] = [...entries.errors];
  const repos: Repo[] = [];
  for (const [name, entry] of entries.value) {
    if (!shortName.test(name)) {
      errors.push({
        code: "CONFIG_INVALID_REPO",
        message: `\`repos\` has the short name \`${name}\`, which a thread reference cannot hold.`,
        recovery:
          "Name the repository with letters, digits, `.`, `_` and `-` only.",
      });
      continue;
    }
    const repo = parseRepo(name, entry);
    errors.push(...repo.errors);
    if (repo.value) repos.push(repo.value);
  }
  return { value: repos, errors };
}
