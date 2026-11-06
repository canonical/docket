import type { Field } from "../owed/index.js";
import type { InboxAddress } from "./types.js";

/** The words an empty inbox gives, for its filter. */
export default function describeEmptyInbox(address: InboxAddress): Field {
  return {
    text:
      address.filter === "unread" ? "nothing unread" : "nothing in the inbox",
    kind: "words",
  };
}
