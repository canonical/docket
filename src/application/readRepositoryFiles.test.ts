import { describe, expect, it, vi } from "vitest";
import { parseFile } from "../lib/config/index.js";
import { providerError } from "../testing/provider.js";
import { recordedProvider, recordedRepos } from "../testing/recorded.js";
import readRepositoryFiles from "./readRepositoryFiles.js";

const personal = parseFile(
  "version: 1\ntargets:\n  next-move:\n    response: 8h\n",
  "personal",
);
if (!personal.ok) throw new Error("the personal file is valid");
const { layer } = personal;
const files: Record<string, string> = {
  "example-org/example-repo":
    "version: 1\ntargets:\n  next-move:\n    review: 3d\n",
  "example-org/example-docs": "version: 1\ntargetz: {}\n",
};

describe("readRepositoryFiles", () => {
  it("reads each repository's file from its default branch, over the personal file", async () => {
    const readFile = vi.fn(async (repo: string) => files[repo]);
    const { watched, warnings } = await readRepositoryFiles(
      recordedProvider({ readFile }),
      layer,
      recordedRepos,
    );
    expect(readFile).toHaveBeenCalledWith(
      "example-org/example-repo",
      ".github/docket.yaml",
    );
    expect(warnings).toEqual([]);
    const [example, docs] = watched;
    expect(example).toMatchObject({ name: "example" });
    expect(example?.resolved.origins.targets).toBe("repository");
    expect(example?.resolved.settings.targets.nextMove).toEqual({
      response: { amount: 24, unit: "h" },
      review: { amount: 3, unit: "d" },
    });
    expect(docs?.resolved.repositoryErrors.at(0)?.code).toBe(
      "CONFIG_UNKNOWN_KEY",
    );
    expect(docs?.resolved.origins.targets).toBe("built-in");
  });

  it("gives a repository without a file the personal file's settings", async () => {
    const { watched } = await readRepositoryFiles(
      recordedProvider(),
      layer,
      recordedRepos,
    );
    expect(watched.at(0)?.resolved.origins.targets).toBe("personal");
    expect(watched.at(0)?.resolved.repositoryErrors).toEqual([]);
  });

  it("keeps the personal file's settings for a file GitHub fails to give, with a warning", async () => {
    const readFile = vi.fn(async (repo: string) => {
      if (repo === "example-org/example-docs") {
        throw providerError("GITHUB_RATE_LIMITED");
      }
      return undefined;
    });
    const { watched, warnings } = await readRepositoryFiles(
      recordedProvider({ readFile }),
      layer,
      recordedRepos,
    );
    expect(watched.map(({ name }) => name)).toEqual(["example", "docs"]);
    expect(watched.at(1)?.resolved.origins.targets).toBe("personal");
    expect(warnings).toEqual([
      {
        code: "GITHUB_RATE_LIMITED",
        message:
          "docket could not read .github/docket.yaml of example-org/example-docs, so the personal file's settings apply to it: The provider failed with GITHUB_RATE_LIMITED.",
        recovery: "try again",
      },
    ]);
  });

  it.each([
    ["gh's own failure", providerError("GH_NOT_SIGNED_IN")],
    ["a failure without a named code", new TypeError("broken")],
  ])("stops on %s", async (_case, failure) => {
    const provider = recordedProvider({
      readFile: () => Promise.reject(failure),
    });
    await expect(
      readRepositoryFiles(provider, layer, recordedRepos),
    ).rejects.toBe(failure);
  });
});
