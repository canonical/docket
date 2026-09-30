import type { People } from "../config/index.js";
import { type Account, type Author, classify } from "../people/index.js";
import type { Person } from "./types.js";

/**
 * Names an account as a list shows it: its login, whole, with its group.
 * The viewer is `you` whatever the settings say of the account, and
 * found whatever the case, since logins ignore case on GitHub; anyone
 * else takes the group the settings give, `external` read as `outside`.
 *
 * @param viewer The login gh is signed in with, when it is known.
 */
export default function describePerson(
  account: Account | Author,
  people: People,
  viewer: string | undefined,
): Person {
  const group = classify(account, people);
  return {
    text: account.login,
    kind: "person",
    group:
      account.login.toLowerCase() === viewer?.toLowerCase()
        ? "you"
        : group === "external"
          ? "outside"
          : group,
  };
}
