import { describe, expect, it } from "vitest";
import describeEmptyInbox from "./describeEmptyInbox.js";

describe("describeEmptyInbox", () => {
  it("names an empty unread inbox and an empty whole inbox", () => {
    expect(
      describeEmptyInbox({ mode: "inbox", grouping: "repo", filter: "unread" }),
    ).toEqual({ text: "nothing unread", kind: "words" });
    expect(
      describeEmptyInbox({ mode: "inbox", grouping: "repo", filter: "all" }),
    ).toEqual({ text: "nothing in the inbox", kind: "words" });
  });
});
