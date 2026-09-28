import type { Author } from "../people/index.js";
import readAccount from "./readAccount.js";
import type { WrittenNode } from "./types.js";

/** The relations to a repository that make its writer a member of the organisation. */
const members = new Set(["MEMBER", "OWNER"]);

/** Reads the writer of a thread, a comment or a review. */
export default function readAuthor(node: WrittenNode): Author {
  return {
    ...readAccount(node.author),
    member: members.has(node.authorAssociation),
  };
}
