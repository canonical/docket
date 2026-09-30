import { describe, expect, it, vi } from "vitest";
import { thread } from "../../testing/facts.js";
import { everyCapability, fakeProvider } from "../../testing/provider.js";
import syncRepo from "./syncRepo.js";
import type { RepoCache } from "./types.js";

const repo = "example-org/example-repo";
const at = new Date("2026-09-28T10:00:00Z");
const cached: RepoCache = {
  threads: [thread({ number: 1 }), thread({ number: 2 })],
  cursor: { since: "2026-09-28T09:57:00Z" },
  tag: '"tag-1"',
  reconciledAt: new Date("2026-09-28T09:30:00Z"),
};

describe("syncRepo", () => {
  it("fetches every open thread when nothing is cached, reporting the check, then each page", async () => {
    const onStage = vi.fn();
    const provider = fakeProvider({
      probe: vi.fn(async () => ({ changed: true, tag: '"tag-2"' })),
      snapshot: vi.fn(async (_repo, _cursor, report) => {
        report?.({ fetched: 1, total: 1 });
        return {
          threads: [thread({ number: 3 }), thread({ number: 4, open: false })],
          cursor: { since: "2026-09-28T09:59:00Z" },
        };
      }),
    });
    expect(await syncRepo(provider, repo, undefined, at, { onStage })).toEqual({
      threads: [thread({ number: 3 })],
      cursor: { since: "2026-09-28T09:59:00Z" },
      tag: '"tag-2"',
      reconciledAt: at,
    });
    expect(provider.probe).toHaveBeenCalledWith(repo, undefined);
    expect(onStage.mock.calls).toEqual([
      [{ kind: "checking" }],
      [{ kind: "reading", fetched: 0, total: 0 }],
      [{ kind: "reading", fetched: 1, total: 1 }],
    ]);
  });

  it("reports reading, with no pages, while it fetches the threads changed since the cursor", async () => {
    const onStage = vi.fn();
    const provider = fakeProvider({
      snapshot: async () => ({ threads: [], cursor: cached.cursor }),
    });
    await syncRepo(provider, repo, cached, at, { onStage });
    expect(onStage.mock.calls).toEqual([
      [{ kind: "checking" }],
      [{ kind: "reading", fetched: 0, total: 0 }],
    ]);
  });

  it("fetches nothing more when the free check sees no change", async () => {
    const provider = fakeProvider({
      probe: vi.fn(async () => ({ changed: false, tag: '"tag-1"' })),
      snapshot: vi.fn(),
    });
    expect(await syncRepo(provider, repo, cached, at)).toEqual(cached);
    expect(provider.probe).toHaveBeenCalledWith(repo, '"tag-1"');
    expect(provider.snapshot).not.toHaveBeenCalled();
  });

  it("fetches the threads changed since the cursor when the check sees a change", async () => {
    const provider = fakeProvider({
      probe: async () => ({ changed: true, tag: '"tag-2"' }),
      snapshot: vi.fn(async () => ({
        threads: [thread({ number: 2, open: false }), thread({ number: 5 })],
        cursor: { since: "2026-09-28T09:59:30Z" },
      })),
    });
    expect(await syncRepo(provider, repo, cached, at)).toEqual({
      threads: [thread({ number: 1 }), thread({ number: 5 })],
      cursor: { since: "2026-09-28T09:59:30Z" },
      tag: '"tag-2"',
      reconciledAt: cached.reconciledAt,
    });
    expect(provider.snapshot).toHaveBeenCalledWith(repo, cached.cursor);
  });

  it("fetches every open thread again an hour after the last time, changed or not", async () => {
    const provider = fakeProvider({
      probe: async () => ({ changed: false, tag: '"tag-1"' }),
      snapshot: vi.fn(async () => ({ threads: [thread()], cursor: null })),
    });
    const later = new Date("2026-09-28T10:30:00Z");
    const synced = await syncRepo(provider, repo, cached, later);
    expect(provider.snapshot).toHaveBeenCalledWith(
      repo,
      null,
      expect.any(Function),
    );
    expect(synced).toMatchObject({ threads: [thread()], reconciledAt: later });
  });

  it("runs only the free check when it may not spend, keeping a repository it sees unchanged at its new tag", async () => {
    const provider = fakeProvider({
      probe: vi.fn(async () => ({ changed: false, tag: '"tag-1"' })),
      snapshot: vi.fn(),
    });
    const later = new Date("2026-09-28T10:30:00Z");
    expect(
      await syncRepo(provider, repo, cached, later, { spend: false }),
    ).toEqual(cached);
    expect(provider.probe).toHaveBeenCalledWith(repo, '"tag-1"');
    expect(provider.snapshot).not.toHaveBeenCalled();
  });

  it("gives nothing, and reports the repository paused, when it may not spend and the check sees a change, or nothing is cached", async () => {
    const onStage = vi.fn();
    const provider = fakeProvider({
      probe: vi.fn(async () => ({ changed: true, tag: '"tag-2"' })),
      snapshot: vi.fn(),
    });
    expect(
      await syncRepo(provider, repo, cached, at, { spend: false, onStage }),
    ).toBeUndefined();
    expect(onStage.mock.calls).toEqual([
      [{ kind: "checking" }],
      [{ kind: "paused", reason: "budget" }],
    ]);
    expect(
      await syncRepo(provider, repo, undefined, at, { spend: false }),
    ).toBeUndefined();
    expect(provider.probe).toHaveBeenCalledOnce();
    expect(provider.snapshot).not.toHaveBeenCalled();
  });

  it("fetches since the cursor every time from a provider with no free check", async () => {
    const capabilities = new Set(everyCapability);
    capabilities.delete("changeProbe");
    const provider = fakeProvider({
      capabilities: () => capabilities,
      probe: vi.fn(),
      snapshot: vi.fn(async () => ({ threads: [], cursor: cached.cursor })),
    });
    expect(await syncRepo(provider, repo, cached, at)).toEqual({
      ...cached,
      tag: undefined,
    });
    expect(provider.probe).not.toHaveBeenCalled();
    expect(provider.snapshot).toHaveBeenCalledWith(repo, cached.cursor);
  });
});
