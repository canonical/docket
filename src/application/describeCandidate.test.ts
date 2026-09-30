import { describe, expect, it } from "vitest";
import type { Owner } from "../lib/owed/index.js";
import { alice, carol, dave, thread } from "../testing/facts.js";
import { recordedSettings, recordedWatched } from "../testing/recorded.js";
import describeCandidate from "./describeCandidate.js";
import gatherNamed from "./gatherNamed.js";

const watched = recordedWatched();
/** The group an owner carries, or none for a team. */
const groupOf = (owner: Owner) => ("group" in owner ? owner.group : undefined);

const discussed = thread({
  repo: "example-org/example-repo",
  author: dave,
  comments: [{ author: carol, at: new Date("2026-09-22T12:00+02:00") }],
});

describe("describeCandidate", () => {
  it("gives a login the group its repository's settings give it, and you to the viewer", () => {
    expect(describeCandidate("bob", discussed, watched, "alice")).toEqual({
      text: "bob",
      fit: "trimmed",
      group: "team",
    });
    expect(
      groupOf(describeCandidate("Alice", discussed, watched, "alice")),
    ).toBe("you");
  });

  it("reads membership from what an unlisted person wrote on the thread, and puts anyone else outside", () => {
    expect(
      groupOf(describeCandidate("carol", discussed, watched, "alice")),
    ).toBe("internal");
    expect(
      groupOf(describeCandidate("erin", discussed, watched, "alice")),
    ).toBe("outside");
  });

  it("reads membership from what they wrote on any thread the view holds, a review included", () => {
    const other = thread({
      number: 2,
      reviews: [{ author: carol, at: new Date("2026-09-22T12:00+02:00") }],
    });
    expect(
      groupOf(
        describeCandidate(
          "carol",
          thread(),
          watched,
          "alice",
          gatherNamed([other]),
        ),
      ),
    ).toBe("internal");
  });

  it("gives a team the viewer belongs to you, from a review requested of it on a held thread, and one they are not in the organisation", () => {
    const requested = thread({
      number: 3,
      reviewRequests: [
        {
          reviewer: { team: "example-org/ui", members: ["Alice"] },
          at: new Date("2026-09-22T12:00+02:00"),
        },
      ],
    });
    expect(
      describeCandidate(
        "example-org/UI",
        discussed,
        watched,
        "alice",
        gatherNamed([requested]),
      ),
    ).toEqual({ text: "example-org/UI", fit: "trimmed", group: "you" });
    expect(
      groupOf(
        describeCandidate(
          "example-org/ui",
          discussed,
          watched,
          "bob",
          gatherNamed([requested]),
        ),
      ),
    ).toBe("internal");
  });

  it("puts any other team in the organisation, whose members it does not know", () => {
    expect(
      describeCandidate("example-org/reviewers", discussed, watched, "alice"),
    ).toEqual({
      text: "example-org/reviewers",
      fit: "trimmed",
      group: "internal",
    });
  });

  it("gives a team the personal file lists as yours you, without reading its members", () => {
    const yours = recordedWatched({
      ...recordedSettings,
      you: { teams: ["example-org/reviewers"] },
    });
    expect(
      describeCandidate("Example-Org/Reviewers", discussed, yours, "alice"),
    ).toEqual({
      text: "Example-Org/Reviewers",
      fit: "trimmed",
      group: "you",
    });
    expect(
      groupOf(describeCandidate("example-org/docs", discussed, yours, "alice")),
    ).toBe("internal");
  });

  it("lists nobody for a repository not watched", () => {
    const elsewhere = {
      ...discussed,
      repo: "example-org/other",
      author: alice,
    };
    expect(
      groupOf(describeCandidate("bob", elsewhere, watched, undefined)),
    ).toBe("outside");
  });
});
