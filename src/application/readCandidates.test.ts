import { describe, expect, it, vi } from "vitest";
import { alice, carol } from "../testing/facts.js";
import { crash, parserFix, recordedProvider } from "../testing/recorded.js";
import readCandidates from "./readCandidates.js";

describe("readCandidates", () => {
  it("reads the assignees GitHub records now, and everyone it can assign", async () => {
    const assignableUsers = vi.fn(async () => [alice, carol]);
    const provider = recordedProvider({ assignableUsers });
    expect(await readCandidates(provider, "assign", parserFix)).toEqual({
      current: ["alice"],
      offered: ["alice", "carol"],
    });
    expect(assignableUsers).toHaveBeenCalledWith("example-org/example-repo");
    expect(await readCandidates(provider, "assign", crash)).toEqual({
      current: [],
      offered: ["alice", "carol"],
    });
  });

  it("reads the requests, then the suggestions, the collaborators and the teams", async () => {
    expect(
      await readCandidates(recordedProvider(), "review", parserFix),
    ).toEqual({
      current: ["bob"],
      offered: ["carol", "alice", "bob", "carol", "example-org/reviewers"],
    });
  });
});
