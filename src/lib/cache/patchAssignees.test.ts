import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { alice, bob, thread } from "../../testing/facts.js";
import { fakeProvider } from "../../testing/provider.js";
import type { Provider } from "../provider/index.js";
import { cacheFileName } from "./constants.js";
import createCache from "./createCache.js";

const repo = "example-org/example-repo";
const minute = 60_000;

let root: string;
let directory: string;
let clock: Date;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "docket-patch-"));
  directory = join(root, "docket");
  clock = new Date("2026-09-28T10:00:00Z");
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

/** GitHub holding one thread on `repo`, assigned to alice. */
const assignedToAlice = () =>
  fakeProvider({
    snapshot: vi.fn(async () => ({
      threads: [thread({ number: 1, assignees: [alice] })],
      cursor: null,
    })),
  });

/** A cache on the test's folder, filled from `provider`. */
async function openFilled(provider: Provider = assignedToAlice()) {
  const cache = createCache({
    provider,
    repos: [repo],
    directory,
    now: () => clock,
  });
  await cache.read(5 * minute);
  return cache;
}

const assigneesOf = (cache: Awaited<ReturnType<typeof openFilled>>) =>
  cache.threads().threads.map(({ assignees }) => assignees);

describe("createCache, patching assignees", () => {
  it("shows the set at once, keeps the data's date and tells the listeners", async () => {
    const cache = await openFilled();
    const listener = vi.fn();
    cache.subscribe(listener);
    const before = cache.threads();
    cache.patchAssignees({ repo, number: 1 }, [bob]);
    expect(assigneesOf(cache)).toEqual([[bob]]);
    expect(cache.threads()).not.toBe(before);
    expect(cache.threads().syncedAt).toEqual(before.syncedAt);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("takes the set back with the undo it gives", async () => {
    const cache = await openFilled();
    const undo = cache.patchAssignees({ repo, number: 1 }, [bob]);
    undo();
    expect(assigneesOf(cache)).toEqual([[alice]]);
  });

  it("never writes the set to the cache file, whatever saves it", async () => {
    const cache = await openFilled();
    cache.patchAssignees({ repo, number: 1 }, [bob]);
    await cache.readFile(repo, ".github/docket.yaml", 5 * minute);
    const file = await readFile(join(directory, cacheFileName), "utf8");
    expect(file).toContain('"alice"');
    expect(file).not.toContain('"bob"');
    const other = createCache({
      provider: assignedToAlice(),
      repos: [repo],
      directory,
      now: () => clock,
    });
    await other.load();
    expect(assigneesOf(other)).toEqual([[alice]]);
  });

  it("gives way to a newer fetch, which an undo then leaves alone", async () => {
    const cache = await openFilled();
    const undo = cache.patchAssignees({ repo, number: 1 }, [bob]);
    clock = new Date(clock.getTime() + minute);
    await cache.refreshRepo(repo);
    expect(assigneesOf(cache)).toEqual([[alice]]);
    undo();
    expect(assigneesOf(cache)).toEqual([[alice]]);
  });

  it("keeps a newer patch when an older one is taken back", async () => {
    const cache = await openFilled();
    const undo = cache.patchAssignees({ repo, number: 1 }, [bob]);
    cache.patchAssignees({ repo, number: 1 }, []);
    undo();
    expect(assigneesOf(cache)).toEqual([[]]);
  });

  it("leaves alone a thread whose repository holds nothing yet", () => {
    const cache = createCache({
      provider: assignedToAlice(),
      repos: [repo],
      directory,
      now: () => clock,
    });
    const listener = vi.fn();
    cache.subscribe(listener);
    cache.patchAssignees({ repo, number: 1 }, [bob])();
    expect(cache.threads().threads).toEqual([]);
    expect(listener).not.toHaveBeenCalled();
  });
});
