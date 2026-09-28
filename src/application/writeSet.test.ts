import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createCache } from "../lib/cache/index.js";
import type { Provider } from "../lib/provider/index.js";
import { bob } from "../testing/facts.js";
import { providerError } from "../testing/provider.js";
import {
  parserFix,
  recordedNow,
  recordedProvider,
  recordedRepos,
  recordedThreads,
} from "../testing/recorded.js";
import writeSet, { type WriteRequest } from "./writeSet.js";

const folders: string[] = [];
afterEach(async () => {
  for (const folder of folders.splice(0)) {
    await rm(folder, { recursive: true, force: true });
  }
});

/** GitHub as `provider` answers, and a cache on it, filled once. */
async function target(provider: Provider) {
  const directory = await mkdtemp(join(tmpdir(), "docket-write-"));
  folders.push(directory);
  const cache = createCache({
    provider,
    repos: recordedRepos.map(({ repo }) => repo),
    directory,
    now: () => recordedNow,
  });
  await cache.read(0);
  return { provider, cache };
}

/** Assigning bob on the recording's pull request, applied. */
const assignBob: WriteRequest = {
  action: "assign",
  thread: parserFix,
  reference: "example#12",
  wanted: ["bob"],
  apply: true,
  format: "plain",
  retry: "apply again",
};

describe("writeSet", () => {
  it("reads the set GitHub records now and changes nothing when only planning", async () => {
    const setAssignees = vi.fn();
    const outcome = await writeSet(
      await target(
        recordedProvider({
          readAssignees: async () => [{ login: "carol", type: "user" }],
          setAssignees,
        }),
      ),
      { ...assignBob, apply: false },
    );
    expect(outcome).toEqual({ current: ["carol"] });
    expect(setAssignees).not.toHaveBeenCalled();
  });

  it("sends nothing when the set is already the one wanted, whatever its case", async () => {
    const setReviewers = vi.fn();
    const outcome = await writeSet(
      await target(recordedProvider({ setReviewers })),
      { ...assignBob, action: "review", wanted: ["BOB"] },
    );
    expect(outcome).toEqual({ current: ["bob"] });
    expect(setReviewers).not.toHaveBeenCalled();
  });

  it("sets the whole set and gives the set GitHub records", async () => {
    const setAssignees = vi.fn(recordedProvider().setAssignees);
    const outcome = await writeSet(
      await target(recordedProvider({ setAssignees })),
      { ...assignBob, wanted: [] },
    );
    expect(setAssignees).toHaveBeenCalledWith(parserFix, []);
    expect(outcome).toEqual({ current: ["alice"], applied: [] });
  });

  it("requests reviews from people and teams by name", async () => {
    const setReviewers = vi.fn(recordedProvider().setReviewers);
    const outcome = await writeSet(
      await target(recordedProvider({ setReviewers })),
      {
        ...assignBob,
        action: "review",
        wanted: ["carol", "example-org/reviewers"],
      },
    );
    expect(setReviewers).toHaveBeenCalledWith(parserFix, [
      { login: "carol", type: "user" },
      { team: "example-org/reviewers" },
    ]);
    expect(outcome.applied).toEqual(["carol", "example-org/reviewers"]);
  });

  it("refreshes the thread's repository, so the cache holds the change", async () => {
    let written = false;
    const provider = recordedProvider({
      snapshot: async (repo) => ({
        threads: recordedThreads
          .filter((thread) => thread.repo === repo)
          .map((thread) =>
            written && thread.number === 12
              ? { ...thread, assignees: [bob] }
              : thread,
          ),
        cursor: { since: "2026-09-28T09:59:00Z" },
      }),
      setAssignees: async () => {
        written = true;
        return [bob];
      },
    });
    const { cache } = await target(provider);
    const outcome = await writeSet({ provider, cache }, assignBob);
    expect(outcome).toEqual({ current: ["alice"], applied: ["bob"] });
    const shown = cache.threads().threads.find(({ number }) => number === 12);
    expect(shown?.assignees).toEqual([bob]);
  });

  it("gives a failed refresh as a warning, the change being made", async () => {
    let written = false;
    const provider = recordedProvider({
      snapshot: async (repo) => {
        if (written) throw providerError("GITHUB_RATE_LIMITED");
        return recordedProvider().snapshot(repo, null);
      },
      setAssignees: async () => {
        written = true;
        return [bob];
      },
    });
    const outcome = await writeSet(await target(provider), assignBob);
    expect(outcome).toEqual({
      current: ["alice"],
      applied: ["bob"],
      warning: {
        code: "GITHUB_RATE_LIMITED",
        message: "The provider failed with GITHUB_RATE_LIMITED.",
        recovery: "try again",
      },
    });
  });

  it("lets a defect in the refresh through", async () => {
    let written = false;
    const provider = recordedProvider({
      snapshot: async (repo) => {
        if (written) throw new Error("a defect");
        return recordedProvider().snapshot(repo, null);
      },
      setAssignees: async () => {
        written = true;
        return [bob];
      },
    });
    await expect(writeSet(await target(provider), assignBob)).rejects.toThrow(
      "a defect",
    );
  });

  it("names whom GitHub left out, with WRITE_INCOMPLETE", async () => {
    const outcome = await writeSet(
      await target(recordedProvider({ setReviewers: async () => [] })),
      { ...assignBob, action: "review", wanted: ["carol"], format: "llm" },
    );
    expect(outcome.shortfall).toEqual({
      code: "WRITE_INCOMPLETE",
      message: 'GitHub did not record "carol" on example#12.',
      recovery:
        'check that "carol" can be asked for a review in example-org/example-repo, then apply again',
    });
  });

  it("names whom GitHub kept, with WRITE_INCOMPLETE", async () => {
    const outcome = await writeSet(
      await target(
        recordedProvider({
          setAssignees: async () => [
            { login: "alice", type: "user" },
            { login: "bob", type: "user" },
          ],
        }),
      ),
      assignBob,
    );
    expect(outcome.shortfall).toEqual({
      code: "WRITE_INCOMPLETE",
      message: "GitHub still records alice on example#12.",
      recovery:
        "run docket show example#12 to see whom GitHub records, then apply again",
    });
  });

  it("lets GitHub's refusal through", async () => {
    const provider = recordedProvider({
      setAssignees: () =>
        Promise.reject(providerError("GITHUB_REQUEST_FAILED")),
    });
    await expect(
      writeSet(await target(provider), assignBob),
    ).rejects.toMatchObject({ code: "GITHUB_REQUEST_FAILED" });
  });
});
