/** A repository's owner and name, as GitHub's API asks for them. */
export interface RepoName {
  readonly owner: string;
  readonly name: string;
}

/** Splits `owner/name` into its two parts. */
export default function splitRepo(repo: string): RepoName {
  const [owner = "", name = ""] = repo.split("/");
  return { owner, name };
}
