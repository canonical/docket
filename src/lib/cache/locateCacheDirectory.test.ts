import { describe, expect, it, vi } from "vitest";
import locateCacheDirectory from "./locateCacheDirectory.js";

vi.mock("node:os", async (original) => ({
  ...(await original<typeof import("node:os")>()),
  homedir: () => "/srv/example",
}));

describe("locateCacheDirectory", () => {
  it("names docket's folder in $XDG_CACHE_HOME", () => {
    expect(locateCacheDirectory({ XDG_CACHE_HOME: "/var/cache/example" })).toBe(
      "/var/cache/example/docket",
    );
  });

  it("names docket's folder in ~/.cache when $XDG_CACHE_HOME is unset or relative", () => {
    expect(locateCacheDirectory({})).toBe("/srv/example/.cache/docket");
    expect(locateCacheDirectory({ XDG_CACHE_HOME: "cache" })).toBe(
      "/srv/example/.cache/docket",
    );
  });
});
