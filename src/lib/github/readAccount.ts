import type { Account } from "../people/index.js";
import type { ActorNode, RestAccount } from "./types.js";

/**
 * Reads an account as GraphQL or REST gives it. A bot is told by the
 * account type GitHub records, never by its login: GraphQL gives a bot's
 * login without the `[bot]` suffix. A deleted account, which GitHub
 * gives as nothing, reads as `ghost`, the name GitHub shows for it.
 */
export default function readAccount(
  node: ActorNode | RestAccount | null,
): Account {
  if (!node) return { login: "ghost", type: "user" };
  const type = "__typename" in node ? node.__typename : node.type;
  return { login: node.login, type: type === "Bot" ? "bot" : "user" };
}
