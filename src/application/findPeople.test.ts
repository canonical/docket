import { describe, expect, it } from "vitest";
import { carol, dave, thread } from "../testing/facts.js";
import { recordedWatched } from "../testing/recorded.js";
import findPeople from "./findPeople.js";

const watched = recordedWatched();

describe("findPeople", () => {
  it("gives a repository's settings' people, with the members who wrote on its own threads", () => {
    const own = thread({
      repo: "example-org/example-repo",
      comments: [{ author: carol, at: new Date("2026-09-22T12:00+02:00") }],
    });
    const elsewhere = thread({
      repo: "example-org/other",
      author: { ...dave, member: true },
    });
    const people = findPeople(
      "example-org/example-repo",
      [own, elsewhere],
      watched,
    );
    expect(people.get("bob")).toBe("team");
    expect(people.get("carol")).toBe("internal");
    expect(people.has("dave")).toBe(false);
  });

  it("lists nobody for a repository not watched", () => {
    expect(findPeople("example-org/other", [], watched).size).toBe(0);
  });
});
