import { describe, expect, it } from "vitest";
import parseRepos from "./parseRepos.js";

const repos = (entries: Record<string, Record<string, unknown>>) =>
  new Map(
    Object.entries(entries).map(([name, fields]) => [
      name,
      new Map(Object.entries(fields)),
    ]),
  );

describe("parseRepos", () => {
  it("reads each short name, its repository and its tags", () => {
    expect(
      parseRepos(
        repos({
          example: { repo: "example-org/example-repo", tags: ["core"] },
          docs: { repo: "example-org/example-docs" },
        }),
      ),
    ).toEqual({
      value: [
        { name: "example", repo: "example-org/example-repo", tags: ["core"] },
        { name: "docs", repo: "example-org/example-docs", tags: [] },
      ],
      errors: [],
    });
  });

  it("refuses a section that is not a map", () => {
    expect(parseRepos(["example-org/example-repo"])).toEqual({
      value: undefined,
      errors: [expect.objectContaining({ code: "CONFIG_WRONG_TYPE" })],
    });
  });

  it("refuses a short name a thread reference cannot hold", () => {
    expect(
      parseRepos(repos({ "my repo": { repo: "example-org/example-repo" } })),
    ).toEqual({
      value: [],
      errors: [
        {
          code: "CONFIG_INVALID_REPO",
          message:
            "`repos` has the short name `my repo`, which a thread reference cannot hold.",
          recovery:
            "Name the repository with letters, digits, `.`, `_` and `-` only.",
        },
      ],
    });
  });

  it("refuses an entry that is not a map", () => {
    const checked = parseRepos(new Map([["example", "example-org/x"]]));
    expect(checked.value).toEqual([]);
    expect(checked.errors).toEqual([
      expect.objectContaining({
        code: "CONFIG_WRONG_TYPE",
        message: "`repos.example` is not a map of keys and values.",
      }),
    ]);
  });

  it("refuses an entry that does not say which repository it is", () => {
    expect(parseRepos(repos({ example: { tags: [] } })).errors).toEqual([
      {
        code: "CONFIG_INVALID_REPO",
        message: "`repos.example` does not say which repository it is.",
        recovery:
          "Write `repo: owner/name` under `repos.example`, such as `repo: example-org/example-repo`.",
      },
    ]);
  });

  it("refuses a repository not written as owner/name", () => {
    const checked = parseRepos(repos({ example: { repo: "example-repo" } }));
    expect(checked.value).toEqual([]);
    expect(checked.errors).toEqual([
      expect.objectContaining({
        code: "CONFIG_INVALID_REPO",
        message:
          '`repos.example.repo` is `"example-repo"`, which is not a repository written as owner/name.',
      }),
    ]);
  });

  it("refuses a key it does not know and still reads the entry", () => {
    const checked = parseRepos(
      repos({ example: { repo: "example-org/example-repo", branch: "main" } }),
    );
    expect(checked.value).toEqual([
      { name: "example", repo: "example-org/example-repo", tags: [] },
    ]);
    expect(checked.errors.map((error) => error.code)).toEqual([
      "CONFIG_UNKNOWN_KEY",
    ]);
  });

  it("refuses tags that are not a list", () => {
    const checked = parseRepos(
      repos({ example: { repo: "example-org/example-repo", tags: "core" } }),
    );
    expect(checked.value).toEqual([
      { name: "example", repo: "example-org/example-repo", tags: [] },
    ]);
    expect(checked.errors).toEqual([
      expect.objectContaining({
        code: "CONFIG_WRONG_TYPE",
        message: "`repos.example.tags` is not a list.",
      }),
    ]);
  });

  it("keeps the tags that are text and refuses the others", () => {
    const checked = parseRepos(
      repos({
        example: { repo: "example-org/example-repo", tags: ["core", 2] },
      }),
    );
    expect(checked.value).toEqual([
      { name: "example", repo: "example-org/example-repo", tags: ["core"] },
    ]);
    expect(checked.errors).toEqual([
      expect.objectContaining({
        code: "CONFIG_WRONG_TYPE",
        message: "`repos.example.tags` holds `2`, which is not text.",
      }),
    ]);
  });
});
