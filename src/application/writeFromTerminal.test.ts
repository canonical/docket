import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createCache } from "../lib/cache/index.js";
import type { Provider } from "../lib/provider/index.js";
import { providerError } from "../testing/provider.js";
import {
  parserFix,
  recordedNow,
  recordedProvider,
  recordedRepos,
  recordedThreads,
} from "../testing/recorded.js";
import writeFromTerminal from "./writeFromTerminal.js";

const folders: string[] = [];
afterEach(async () => {
  for (const folder of folders.splice(0)) {
    await rm(folder, { recursive: true, force: true });
  }
});

/** GitHub as `provider` answers, and a cache on it, filled once. */
async function target(provider: Provider) {
  const directory = await mkdtemp(join(tmpdir(), "docket-terminal-write-"));
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

/**
 * GitHub on the recording, whose snapshots give the recording's pull
 * request the assignees `recorded` names once it is set.
 */
function recordedAssigning(
  recorded: () => readonly string[] | undefined,
  overrides: Partial<Provider> = {},
) {
  return recordedProvider({
    snapshot: async (repo) => ({
      threads: recordedThreads
        .filter((thread) => thread.repo === repo)
        .map((thread) => {
          const logins = recorded();
          return logins && thread.number === parserFix.number
            ? {
                ...thread,
                assignees: logins.map((login) => ({
                  login,
                  type: "user" as const,
                })),
              }
            : thread;
        }),
      cursor: { since: "2026-09-28T09:59:00Z" },
    }),
    ...overrides,
  });
}

/** The logins the cache gives as the recording's pull request's assignees. */
const readAssigned = ({ cache }: Awaited<ReturnType<typeof target>>) =>
  cache
    .threads()
    .threads.find((thread) => thread.number === parserFix.number)
    ?.assignees.map(({ login }) => login);

const assignBob = {
  action: "assign",
  thread: parserFix,
  reference: "example#12",
  wanted: ["bob"],
} as const;

describe("writeFromTerminal", () => {
  it("shows an assignment at once, then the thread GitHub records", async () => {
    const answer = Promise.withResolvers<void>();
    let recorded: readonly string[] | undefined;
    const written = await target(
      recordedAssigning(() => recorded, {
        setAssignees: async (_thread, logins) => {
          await answer.promise;
          recorded = ["bob", "carol"];
          return logins.map((login) => ({ login, type: "user" }));
        },
      }),
    );
    expect(readAssigned(written)).toEqual(["alice"]);
    const writing = writeFromTerminal(written, assignBob);
    expect(readAssigned(written)).toEqual(["bob"]);
    answer.resolve();
    expect(await writing).toMatchObject({ applied: ["bob"] });
    expect(readAssigned(written)).toEqual(["bob", "carol"]);
  });

  it("takes the assignment back when GitHub refuses it, saying to apply again", async () => {
    const refused = Object.assign(new Error("GitHub refused the request."), {
      code: "GITHUB_REQUEST_FAILED",
      recovery: "change what GitHub's reason names, then refresh",
      step: "change what GitHub's reason names",
    });
    const written = await target(
      recordedProvider({ setAssignees: () => Promise.reject(refused) }),
    );
    await expect(writeFromTerminal(written, assignBob)).rejects.toMatchObject({
      recovery: "change what GitHub's reason names, then apply again",
    });
    expect(readAssigned(written)).toEqual(["alice"]);
  });

  it("shows the set GitHub answered when it records another and the refresh fails", async () => {
    const base = recordedProvider();
    let offline = false;
    const written = await target(
      recordedProvider({
        setAssignees: async () => {
          offline = true;
          return [];
        },
        snapshot: (repo, cursor) =>
          offline
            ? Promise.reject(providerError("GITHUB_TIMED_OUT"))
            : base.snapshot(repo, cursor),
      }),
    );
    const outcome = await writeFromTerminal(written, assignBob);
    expect(outcome.shortfall?.code).toBe("WRITE_INCOMPLETE");
    expect(outcome.warning?.code).toBe("GITHUB_TIMED_OUT");
    expect(readAssigned(written)).toEqual([]);
  });

  it("shows the set GitHub holds when it already is the one asked for", async () => {
    const written = await target(
      recordedProvider({
        readAssignees: async () => [{ login: "bob", type: "user" }],
      }),
    );
    expect(await writeFromTerminal(written, assignBob)).toEqual({
      current: ["bob"],
    });
    expect(readAssigned(written)).toEqual(["bob"]);
  });

  it("shows a review request only once GitHub answers", async () => {
    const answer = Promise.withResolvers<void>();
    const base = recordedProvider();
    const written = await target(
      recordedProvider({
        setReviewers: async (thread, reviewers) => {
          await answer.promise;
          return base.setReviewers(thread, reviewers);
        },
      }),
    );
    const before = written.cache.threads();
    const writing = writeFromTerminal(written, {
      ...assignBob,
      action: "review",
      wanted: ["carol"],
    });
    expect(written.cache.threads()).toBe(before);
    answer.resolve();
    expect(await writing).toMatchObject({ applied: ["carol"] });
  });
});
