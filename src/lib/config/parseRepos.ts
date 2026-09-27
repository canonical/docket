import checkList from "./checkList.js";
import checkMap from "./checkMap.js";
import checkText from "./checkText.js";
import type { ConfigError, Repo } from "./types.js";

// A short name is written before `#` in a thread reference, as in `ds#88`.
const shortName = /^[A-Za-z0-9._-]+$/;
const ownerAndName = /^[A-Za-z0-9-]+\/[A-Za-z0-9._-]+$/;

function parseRepo(
  name: string,
  value: unknown,
  errors: ConfigError[],
): Repo | undefined {
  const path = `repos.${name}`;
  const entries = checkMap(value, path, errors, ["repo", "tags"]);
  if (!entries) return undefined;
  const repo = entries.get("repo");
  if (typeof repo !== "string" || !ownerAndName.test(repo)) {
    errors.push({
      code: "CONFIG_INVALID_REPO",
      message: `\`${path}.repo\` is \`${String(repo)}\`, which is not a repository written as owner/name.`,
      recovery: `Write \`repo: owner/name\` under \`${path}\`, such as \`repo: example-org/example-repo\`.`,
    });
    return undefined;
  }
  const tags = entries.has("tags")
    ? (checkList(entries.get("tags"), `${path}.tags`, errors) ?? [])
    : [];
  return {
    name,
    repo,
    tags: tags.flatMap((tag) => {
      const text = checkText(tag, `${path}.tags`, errors);
      return text === undefined ? [] : [text];
    }),
  };
}

/** Reads the `repos` section: each short name and its repository. */
export default function parseRepos(
  value: unknown,
  errors: ConfigError[],
): Repo[] | undefined {
  const entries = checkMap(value, "repos", errors);
  if (!entries) return undefined;
  const repos: Repo[] = [];
  for (const [name, entry] of entries) {
    if (!shortName.test(name)) {
      errors.push({
        code: "CONFIG_INVALID_REPO",
        message: `\`repos\` has the short name \`${name}\`, which a thread reference cannot hold.`,
        recovery:
          "Name the repository with letters, digits, `.`, `_` and `-` only.",
      });
      continue;
    }
    const repo = parseRepo(name, entry, errors);
    if (repo) repos.push(repo);
  }
  return repos;
}
