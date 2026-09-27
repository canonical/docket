import fragments from "./fragments.js";
import splitRepo from "./splitRepo.js";
import type { Client } from "./types.js";

const document = `query File($owner: String!, $name: String!, $expression: String!) {
  ${fragments.rateLimit}
  repository(owner: $owner, name: $name) {
    object(expression: $expression) { ... on Blob { text } }
  }
}`;

interface Answer {
  readonly repository: {
    readonly object: { readonly text?: string | null } | null;
  } | null;
}

/**
 * Reads the text of the file at `path` on `repo`'s default branch, which
 * `HEAD` names. A path that holds no file, a folder, or a file GitHub
 * gives no text for, such as an image, reads as absent, and so does a
 * repository GitHub does not show the reader.
 *
 * @note Impure: reads from GitHub.
 * @returns The file's text, or `undefined` when it is absent.
 */
export default async function fetchFile(
  client: Client,
  repo: string,
  path: string,
): Promise<string | undefined> {
  const { owner, name } = splitRepo(repo);
  const answer = await client.query<Answer>(
    document,
    { owner, name, expression: `HEAD:${path}` },
    { allowMissing: true },
  );
  return answer.repository?.object?.text ?? undefined;
}
