import { afterEach, expect, it, vi } from "vitest";
import manifest from "../../package.json" with { type: "json" };

afterEach(() => {
  vi.restoreAllMocks();
});

it("prints the manifest's version when it starts", async () => {
  const write = vi
    .spyOn(process.stdout, "write")
    .mockImplementation(() => true);

  await import("./main.js");

  expect(write).toHaveBeenCalledExactlyOnceWith(`${manifest.version}\n`);
});
