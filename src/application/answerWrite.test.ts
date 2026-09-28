import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type Home, makeHome, openSession } from "../testing/docket.js";
import { providerError } from "../testing/provider.js";
import {
  parserFix,
  recordedProvider,
  tokensGuide,
} from "../testing/recorded.js";
import answerWrite from "./answerWrite.js";

let home: Home;

beforeEach(async () => {
  home = await makeHome();
});

afterEach(async () => {
  await home.remove();
});

describe("answerWrite", () => {
  it.each([
    ["assign", "bob", '- add "bob"\n- remove "alice"\n'],
    ["review", "carol", '- add "carol"\n- remove "bob"\n'],
  ] as const)(
    "prints the plan of %s and changes nothing without --confirm",
    async (command, name, changes) => {
      const setAssignees = vi.fn();
      const setReviewers = vi.fn();
      const { session, out } = openSession(
        home,
        [command, "example#12", name],
        recordedProvider({ setAssignees, setReviewers }),
      );
      expect(await answerWrite(session)).toBe(0);
      expect(out()).toContain(changes);
      expect(out()).toContain(
        `\`docket ${command} example#12 ${name} --confirm\``,
      );
      expect(setAssignees).not.toHaveBeenCalled();
      expect(setReviewers).not.toHaveBeenCalled();
    },
  );

  it("plans from the assignees GitHub records now, not from the cache", async () => {
    // The cache holds alice; since then, bob took her place on GitHub.
    const setAssignees = vi.fn(recordedProvider().setAssignees);
    const provider = recordedProvider({
      readAssignees: async () => [{ login: "bob", type: "user" }],
      setAssignees,
    });
    const plan = openSession(home, ["assign", "example#12", "alice"], provider);
    await answerWrite(plan.session);
    expect(plan.out()).toContain('- add "alice"\n- remove "bob"\n');
    const { session } = openSession(
      home,
      ["assign", "example#12", "alice", "--confirm"],
      provider,
    );
    expect(await answerWrite(session)).toBe(0);
    expect(setAssignees).toHaveBeenCalledWith(parserFix, ["alice"]);
  });

  it("sets the whole set with --confirm, and prints what GitHub records", async () => {
    const provider = recordedProvider({
      setAssignees: vi.fn(recordedProvider().setAssignees),
    });
    const { session, out } = openSession(
      home,
      ["assign", "example#12", "bob", "carol", "--confirm"],
      provider,
    );
    expect(await answerWrite(session)).toBe(0);
    expect(provider.setAssignees).toHaveBeenCalledWith(parserFix, [
      "bob",
      "carol",
    ]);
    expect(out()).toContain(
      'The assignees of example#12 are now: "bob", "carol".',
    );
  });

  it("requests reviews from people and teams, planning from the requests GitHub records", async () => {
    const provider = recordedProvider({
      setReviewers: vi.fn(recordedProvider().setReviewers),
    });
    const { session, out } = openSession(
      home,
      ["review", "example#12", "carol", "example-org/reviewers", "--confirm"],
      provider,
    );
    await answerWrite(session);
    expect(provider.setReviewers).toHaveBeenCalledWith(parserFix, [
      { login: "carol", type: "user" },
      { team: "example-org/reviewers" },
    ]);
    expect(out()).toContain(
      '- added "carol", "example-org/reviewers"\n- removed "bob"\n',
    );
  });

  it("sends nothing when the set is already the one asked for, whatever its case", async () => {
    const setReviewers = vi.fn();
    const { session, out } = openSession(
      home,
      ["review", "example#12", "BOB", "--confirm"],
      recordedProvider({ setReviewers }),
    );
    expect(await answerWrite(session)).toBe(0);
    expect(out()).toContain("Nothing to change");
    expect(setReviewers).not.toHaveBeenCalled();
  });

  it("returns 3 with WRITE_INCOMPLETE when GitHub records less than was asked for", async () => {
    const provider = recordedProvider({
      setAssignees: async () => [{ login: "bob", type: "user" }],
    });
    const { session, out, err } = openSession(
      home,
      ["assign", "example#12", "bob", "mallory", "--confirm"],
      provider,
    );
    expect(await answerWrite(session)).toBe(3);
    expect(out()).toContain('are now: "bob".');
    expect(err()).toBe(
      '## Error: WRITE_INCOMPLETE\nGitHub did not record "mallory" on example#12.\nRecovery: check that "mallory" can be assigned in example-org/example-repo, then run the command again\n',
    );
    const reviews = openSession(
      home,
      ["review", "example#12", "carol", "--confirm", "--format", "plain"],
      recordedProvider({ setReviewers: async () => [] }),
    );
    expect(await answerWrite(reviews.session)).toBe(3);
    expect(reviews.err()).toContain(
      "Error WRITE_INCOMPLETE\nGitHub did not record carol on example#12.\nRecovery: check that carol can be asked for a review in",
    );
  });

  it("returns 3 with WRITE_INCOMPLETE when GitHub keeps someone the set leaves out", async () => {
    const provider = recordedProvider({
      setAssignees: async () => [
        { login: "alice", type: "user" },
        { login: "bob", type: "user" },
      ],
    });
    const { session, err } = openSession(
      home,
      ["assign", "example#12", "bob", "--confirm"],
      provider,
    );
    expect(await answerWrite(session)).toBe(3);
    expect(err()).toBe(
      '## Error: WRITE_INCOMPLETE\nGitHub still records "alice" on example#12.\nRecovery: run docket show example#12 to see whom GitHub records, then run the command again\n',
    );
  });

  it("lets GitHub's refusal through", async () => {
    const provider = recordedProvider({
      setAssignees: () =>
        Promise.reject(providerError("GITHUB_REQUEST_FAILED")),
    });
    const { session } = openSession(
      home,
      ["assign", "example#12", "bob", "--confirm"],
      provider,
    );
    await expect(answerWrite(session)).rejects.toMatchObject({
      code: "GITHUB_REQUEST_FAILED",
    });
  });

  it("refuses a thread that cannot take the change", async () => {
    const discussion = { ...tokensGuide, kind: "discussion" } as const;
    const provider = recordedProvider({
      snapshot: async (repo) => ({
        threads: repo === discussion.repo ? [discussion] : [],
        cursor: null,
      }),
    });
    const assign = openSession(home, ["assign", "docs#4", "bob"], provider);
    await expect(answerWrite(assign.session)).rejects.toMatchObject({
      code: "THREAD_KIND_UNSUPPORTED",
      message: "docs#4 is a discussion, and discussions have no assignees.",
    });
    const review = openSession(home, ["review", "docs#4", "bob"], provider);
    await expect(answerWrite(review.session)).rejects.toMatchObject({
      code: "THREAD_KIND_UNSUPPORTED",
      message:
        "docs#4 is not a pull request, so no review can be requested on it.",
    });
  });

  it.each([
    [
      ["assign", "example#12"],
      "USAGE_MISSING_ARGUMENT",
      "at least one login after",
    ],
    [
      ["review", "example#12"],
      "USAGE_MISSING_ARGUMENT",
      "at least one login or org/team",
    ],
    [
      ["assign", "example", "stack", "3", "bob"],
      "USAGE_INVALID_REFERENCE",
      "names a stack",
    ],
    [
      ["assign", "example#12", "bob carol"],
      "USAGE_INVALID_VALUE",
      "`bob carol` is not a login as GitHub writes one.",
    ],
    [
      ["assign", "example#12", "example-org/reviewers"],
      "USAGE_INVALID_VALUE",
      "`example-org/reviewers` is not a login",
    ],
    [
      ["review", "example#12", "bob;touch example"],
      "USAGE_INVALID_VALUE",
      "is not a login or an org/team as GitHub writes one.",
    ],
  ] as const)("refuses %j with %s", async (args, code, words) => {
    const { session } = openSession(home, args);
    await expect(answerWrite(session)).rejects.toMatchObject({
      code,
      message: expect.stringContaining(words),
    });
  });
});
