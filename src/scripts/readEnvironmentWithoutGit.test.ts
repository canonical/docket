import { afterEach, describe, expect, it, vi } from "vitest";
import readEnvironmentWithoutGit from "./readEnvironmentWithoutGit.js";

describe("readEnvironmentWithoutGit", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("drops every variable whose name starts with GIT_", () => {
    vi.stubEnv("GIT_DIR", "/example/.git/worktrees/side");
    vi.stubEnv("GIT_INDEX_FILE", "/example/.git/index");
    const env = readEnvironmentWithoutGit();
    expect(Object.keys(env).filter((name) => name.startsWith("GIT_"))).toEqual(
      [],
    );
  });

  it("keeps every other variable", () => {
    vi.stubEnv("EXAMPLE_SETTING", "alice");
    expect(readEnvironmentWithoutGit().EXAMPLE_SETTING).toBe("alice");
  });
});
