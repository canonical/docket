import type { People } from "../config/index.js";
import { type Account, type Author, classify } from "../people/index.js";
import type { Person } from "./types.js";

/**
 * Names an account as a row shows it: its login, whole, with the group the
 * settings put it in and whether it is the viewer. Logins ignore case on
 * GitHub, so the viewer is found whatever the case.
 *
 * @param viewer The login gh is signed in with, when it is known.
 */
export default function describePerson(
  account: Account | Author,
  people: People,
  viewer: string | undefined,
): Person {
  return {
    text: account.login,
    fit: "trimmed",
    group: classify(account, people),
    viewer: account.login.toLowerCase() === viewer?.toLowerCase(),
  };
}
