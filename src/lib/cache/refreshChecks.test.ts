import { describe, expect, it, vi } from "vitest";
import { thread } from "../../testing/facts.js";
import { everyCapability, fakeProvider } from "../../testing/provider.js";
import refreshChecks from "./refreshChecks.js";
import type { RepoCache } from "./types.js";

const running = thread({ kind: "pullRequest", number: 3, checks: "running" });
const passing = thread({ kind: "pullRequest", number: 4, checks: "passing" });
const held = (threads: RepoCache["threads"]): RepoCache => ({
  threads,
  cursor: null,
  tag: undefined,
  reconciledAt: new Date("2026-09-28T09:30:00Z"),
});

describe("refreshChecks", () => {
  it("reads again, in one request, the checks still running on every repository", async () => {
    const docs = thread({
      repo: "example-org/example-docs",
      kind: "pullRequest",
      checks: "running",
    });
    const refreshed = [
      { repo: running.repo, number: 3, checks: "passing" as const },
    ];
    const provider = fakeProvider({
      refreshVolatile: vi.fn(async () => refreshed),
    });
    expect(
      await refreshChecks(provider, [held([running, passing]), held([docs])]),
    ).toEqual(refreshed);
    expect(provider.refreshVolatile).toHaveBeenCalledTimes(1);
    expect(provider.refreshVolatile).toHaveBeenCalledWith([running, docs]);
  });

  it("reads nothing when no check is running", async () => {
    const provider = fakeProvider({ refreshVolatile: vi.fn() });
    const issue = thread({ checks: "running" });
    expect(await refreshChecks(provider, [held([passing, issue])])).toEqual([]);
    expect(provider.refreshVolatile).not.toHaveBeenCalled();
  });

  it("reads nothing from a provider that declares no checks", async () => {
    const capabilities = new Set(everyCapability);
    capabilities.delete("checks");
    const provider = fakeProvider({
      capabilities: () => capabilities,
      refreshVolatile: vi.fn(),
    });
    expect(await refreshChecks(provider, [held([running])])).toEqual([]);
    expect(provider.refreshVolatile).not.toHaveBeenCalled();
  });
});
