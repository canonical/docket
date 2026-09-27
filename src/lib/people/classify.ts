import type { Group, People } from "../config/index.js";
import type { Account } from "./types.js";

/**
 * Puts an account into one of the four author groups.
 *
 * The configuration decides first, so it names the team and corrects any
 * account the fallback gets wrong. For a login it does not list, the order
 * is fixed: a bot account, then a member of the organisation, then
 * everyone else. The team comes only from the configuration, because no
 * fact on GitHub says who owns the moves.
 */
export default function classify(account: Account, people: People): Group {
  const configured = people.get(account.login.toLowerCase());
  if (configured) return configured;
  if (account.type === "bot") return "bot";
  return account.member ? "internal" : "external";
}
