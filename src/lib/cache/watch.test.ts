import * as folders from "node:fs";
import * as files from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { thread } from "../../testing/facts.js";
import { fakeProvider, providerError } from "../../testing/provider.js";
import { waitUntil } from "../../testing/wait.js";
import type { Provider } from "../provider/index.js";
import createCache from "./createCache.js";
import identifyFile from "./identifyFile.js";

// The filesystem, counted: every write and read of the cache file.
vi.mock("node:fs/promises", async (original) => {
  const actual = await original<typeof import("node:fs/promises")>();
  return {
    ...actual,
    rename: vi.fn(actual.rename),
    readFile: vi.fn(actual.readFile),
  };
});
// The watch, which a test can replace with events it sends itself.
vi.mock("node:fs", async (original) => {
  const actual = await original<typeof import("node:fs")>();
  return { ...actual, watch: vi.fn(actual.watch) };
});
// Each identification of a file, so a test can wait for them to finish.
vi.mock("./identifyFile.js", async (original) => {
  const actual = await original<typeof import("./identifyFile.js")>();
  return { default: vi.fn(actual.default) };
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
/**
 * Settles once every identification started so far has, and with it each
 * watch event's choice to load the file or not: the event's handler waits
 * on the identification before this does.
 */
const identified = () =>
  Promise.all(vi.mocked(identifyFile).mock.results.map(({ value }) => value));
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
    await waitUntil(() => {
      expect(pane.threads().threads).toHaveLength(3);
    });
    await pause(100);
    expect(heard).toHaveBeenCalledTimes(1);
    stop();
  });

  it("reads back none of its own writes, however soon it hears of them", async () => {
    let hear: (event: string, name: string) => void = () => undefined;
    vi.mocked(folders.watch).mockImplementationOnce(((
      _folder: string,
      listener: typeof hear,
    ) => {
      hear = listener;
      return { close: () => undefined };
    }) as unknown as typeof folders.watch);
    // Each write is heard, and the file identified, before the writer
    // takes back control: the soonest the watch can hear of it.
    const actual = await vi.importActual<typeof files>("node:fs/promises");
    const replace = async (from: string, to: string) => {
      await actual.rename(from, to);
      hear("rename", "snapshots.json");
      await identified();
    };
    vi.mocked(files.rename)
      .mockImplementationOnce(replace as typeof files.rename)
      .mockImplementationOnce(replace as typeof files.rename);
    const pane = open(counting());
    const stop = pane.watch();
    await pane.refresh();
    const read = reads();
    later(3 * minute);
    await pane.refresh();
    // The first write's event, heard late.
    hear("rename", "snapshots.json");
    await identified();
    expect(writes()).toBe(2);
    expect(reads()).toBe(read + 1);
    stop();
  });

  it("reloads a write it cannot tell from its own, as when the file cannot be looked at", async () => {
    const pane = open(counting());
    const stop = pane.watch();
    const actual =
      await vi.importActual<typeof import("./identifyFile.js")>(
        "./identifyFile.js",
      );
    // The cache file, once written, cannot be looked at.
    let failed = false;
    vi.mocked(identifyFile).mockImplementation(async (path) => {
      if (failed || !path.endsWith("snapshots.json")) {
        return actual.default(path);
      }
      failed = true;
      throw Object.assign(new Error("I/O error"), { code: "EIO" });
    });
    await open(counting()).read(5 * minute);
    await waitUntil(() => {
      expect(pane.threads().threads).toHaveLength(3);
    });
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
