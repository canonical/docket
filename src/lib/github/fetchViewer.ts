import fragments from "./fragments.js";
import type { Client } from "./types.js";

const document = `query Viewer { ${fragments.rateLimit} viewer { login } }`;

interface Answer {
  readonly viewer: { readonly login: string };
}

/**
 * Reads the login of the account the token belongs to: the one gh is
 * signed in with.
 *
 * @note Impure: reads from GitHub.
 */
export default async function fetchViewer(client: Client): Promise<string> {
  const { viewer } = await client.query<Answer>(document, {});
  return viewer.login;
}
