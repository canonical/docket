import * as files from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { thread } from "../../testing/facts.js";
import { fakeProvider, providerError } from "../../testing/provider.js";
import type { Provider } from "../provider/index.js";
import createCache from "./createCache.js";

// The filesystem, counted: every write and read of the cache file.
vi.mock("node:fs/promises", async (original) => {
  const actual = await original<typeof import("node:fs/promises")>();
  return {
    ...actual,
    rename: vi.fn(actual.rename),
    readFile: vi.fn(actual.readFile),
  };
});

const repo = "example-org/example-repo";
const docs = "example-org/example-docs";
const site = "example-org/example-site";
const minute = 60_000;

let root: string;
let directory: string;
let clock: Date;

beforeEach(async () => {
  root = await files.mkdtemp(join(tmpdir(), "docket-watch-"));
  directory = join(root, "docket");
  clock = new Date("2026-09-28T10:00:00Z");
});

afterEach(async () => {
  vi.clearAllMocks();
  await files.rm(root, { recursive: true, force: true });
});

const open = (provider: Provider, repos = [repo, docs, site]) =>
  createCache({ provider, repos, directory, now: () => clock });
const later = (milliseconds: number) => {
  clock = new Date(clock.getTime() + milliseconds);
};
const pause = (milliseconds: number) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));
/** A provider whose snapshots each hold one open thread of the repository. */
const counting = () =>
  fakeProvider({
    snapshot: async (name: string) => ({
      threads: [thread({ repo: name })],
      cursor: null,
    }),
  });
/** How often the cache file was written, and how often read. */
const writes = () =>
  vi
    .mocked(files.rename)
    .mock.calls.filter(([, to]) => String(to).endsWith("snapshots.json"))
    .length;
const reads = () =>
  vi
    .mocked(files.readFile)
    .mock.calls.filter(([from]) => String(from).endsWith("snapshots.json"))
    .length;

describe("the writes and the watch of createCache", () => {
  it("writes the cache file once a sync, however many repositories it syncs", async () => {
    await open(counting()).read(5 * minute);
    expect(writes()).toBe(1);
  });

  it("writes the repositories synced before one that fails", async () => {
    const provider = fakeProvider({
      snapshot: async (name: string) => {
        if (name === docs) throw providerError("GITHUB_REQUEST_FAILED");
        return { threads: [thread({ repo: name })], cursor: null };
      },
    });
    await expect(open(provider).read(5 * minute)).rejects.toMatchObject({
      code: "GITHUB_REQUEST_FAILED",
    });
    const other = open(fakeProvider());
    await other.load();
    expect(other.threads().threads).toEqual([thread({ repo })]);
  });

  it("reloads another process's write once, telling its listeners once", async () => {
    const pane = open(counting());
    const heard = vi.fn();
    pane.subscribe(heard);
    const stop = pane.watch();
    await open(counting()).read(5 * minute);
    await vi.waitFor(() => {
      expect(pane.threads().threads).toHaveLength(3);
    });
    await pause(100);
    expect(heard).toHaveBeenCalledTimes(1);
    stop();
  });

  it("reads back none of its own writes", async () => {
    const pane = open(counting());
    const stop = pane.watch();
    await pane.refresh();
    const read = reads();
    later(3 * minute);
    await pane.refresh();
    expect(reads()).toBe(read + 1);
    await pause(200);
    expect(reads()).toBe(read + 1);
    stop();
  });

  it("tells its listeners nothing when a load finds nothing new", async () => {
    const pane = open(counting());
    await pane.read(5 * minute);
    const heard = vi.fn();
    pane.subscribe(heard);
    await pane.load();
    expect(heard).not.toHaveBeenCalled();
  });
});
