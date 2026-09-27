import { describe, expect, it } from "vitest";
import { resolvedPersonal } from "../../testing/recorded.js";
import renderConfig, { type ConfigAnswer } from "./renderConfig.js";

const shared = resolvedPersonal();
const [example] = shared.settings.repos;
if (!example) throw new Error("the fixture watches repositories");
const answer: ConfigAnswer = {
  personal: { path: "/config/docket/docket.yaml", found: true },
  repositories: [{ repo: example, resolved: shared }],
  shared,
  gh: { login: "alice" },
  warnings: [],
  format: "llm",
};

describe("renderConfig", () => {
  it("gives an agent each setting with the file that set it, and gh's status", () => {
    expect(renderConfig(answer).split("\n")).toEqual([
      "# config",
      "Personal file: /config/docket/docket.yaml, found.",
      'gh: signed in to github.com as "alice".',
      "",
      "## every repository",
      "- repos (personal file): example example-org/example-repo, docs example-org/example-docs",
      "- activity (personal file): 24h, 1w",
      "- hosts (personal file): github.com",
      "- Anyone not listed in people: a bot account is bot, then a member of the organisation is internal, then anyone else is external.",
      "",
      "## example (example-org/example-repo)",
      "- people (personal file): alice team, bob team, example-sync bot",
      "- time (personal file): workdays mon, tue, wed, thu, fri, timezone Europe/Paris",
      "- targets (personal file): next-move.response 8h, next-move.review 1d, close.issue 20d, close.pull-request 3d, close.discussion 1w",
      "- exempt (personal file): close Topic: roadmap, announcement",
      "",
    ]);
  });

  it("gives a person why gh gave no token, and says when no personal file exists", () => {
    const builtIn = resolvedPersonal(false);
    const text = renderConfig({
      personal: { path: "/config/docket/docket.yaml", found: false },
      repositories: [],
      shared: builtIn,
      gh: {
        code: "GH_NOT_SIGNED_IN",
        message: "gh is not signed in to github.com.",
        recovery: "run gh auth login",
      },
      warnings: [],
      format: "plain",
    });
    expect(text.split("\n")).toEqual([
      "config",
      "Personal file: /config/docket/docket.yaml, not found, so built-in defaults apply.",
      "",
      "Error GH_NOT_SIGNED_IN",
      "gh is not signed in to github.com.",
      "Recovery: run gh auth login",
      "",
      "every repository",
      "  repos (built-in default): none",
      "  activity (built-in default): 24h, 48h, 72h, 1w",
      "  hosts (built-in default): github.com",
      "  Anyone not listed in people: a bot account is bot, then a member of the organisation is internal, then anyone else is external.",
      "",
    ]);
  });

  it("gives a program each value, each person's group and why, and gh's status", () => {
    const data = JSON.parse(renderConfig({ ...answer, format: "json" }));
    expect(data).toMatchObject({
      personalFile: { path: "/config/docket/docket.yaml", found: true },
      gh: { signedIn: true, host: "github.com", login: "alice" },
      activity: ["24h", "1w"],
      hosts: ["github.com"],
      origins: { repos: "personal", activity: "personal", hosts: "personal" },
    });
    expect(data.repositories.at(0)).toMatchObject({
      name: "example",
      repo: "example-org/example-repo",
      time: {
        workdays: ["mon", "tue", "wed", "thu", "fri"],
        timezone: "Europe/Paris",
      },
      targets: {
        nextMove: { response: "8h", review: "1d" },
        close: { issue: "20d", pullRequest: "3d", discussion: "1w" },
      },
      exempt: { close: ["Topic: roadmap", "announcement"] },
    });
    expect(data.repositories.at(0).people.at(0)).toEqual({
      login: "alice",
      group: "team",
    });
    expect(data.repositories.at(0).origins.people).toBe("personal");
    const signedOut = JSON.parse(
      renderConfig({
        ...answer,
        format: "json",
        gh: {
          code: "GH_NOT_INSTALLED",
          message: "docket needs gh.\u001b[2J",
          recovery: "install it",
        },
      }),
    );
    expect(signedOut.gh).toEqual({
      signedIn: false,
      error: {
        code: "GH_NOT_INSTALLED",
        message: "docket needs gh.",
        recovery: "install it",
      },
    });
  });

  it("strips control sequences from values a repository's file could carry", () => {
    const people = new Map([
      ["mallory\u001b]52;c;eA==\u0007", "team" as const],
    ]);
    const hostile = {
      ...shared,
      settings: {
        ...shared.settings,
        people,
        exempt: { close: ["\u001b[2Jwontfix"] },
      },
    };
    const text = renderConfig({
      ...answer,
      repositories: [{ repo: example, resolved: hostile }],
    });
    expect(text).not.toContain("\u001b");
    expect(text).toContain("people (personal file): mallory team");
    expect(text).toContain("exempt (personal file): close wontfix");
    const plain = renderConfig({ ...answer, format: "plain" });
    expect(plain).toContain(
      "\nexample (example-org/example-repo)\n  people (personal file):",
    );
  });
});

describe("renderConfig, with repository files", () => {
  const errors = [
    {
      code: "CONFIG_UNKNOWN_KEY",
      message: "The file has an unknown key `\u001b[2Jtargetz`.",
      recovery: "Remove it.",
    },
  ] as const;
  const invalid = { ...shared, repositoryErrors: errors };
  const warning = {
    code: "GITHUB_TIMED_OUT",
    message: "GitHub did not answer in time.",
    recovery: "try again",
  } as const;

  it("names each error of an invalid repository file, and each file GitHub did not give", () => {
    const text = renderConfig({
      ...answer,
      repositories: [{ repo: example, resolved: invalid }],
      warnings: [warning],
    });
    expect(text).toContain(
      "- repository file invalid, so built-in defaults apply: CONFIG_UNKNOWN_KEY The file has an unknown key `targetz`. Recovery: Remove it.\n",
    );
    expect(text).toContain(
      'gh: signed in to github.com as "alice".\n\n## Warning: GITHUB_TIMED_OUT\n',
    );
  });

  it("gives a program the errors and the warnings as data", () => {
    const data = JSON.parse(
      renderConfig({
        ...answer,
        repositories: [{ repo: example, resolved: invalid }],
        warnings: [warning],
        format: "json",
      }),
    );
    expect(data.warnings).toEqual([warning]);
    expect(data.repositories.at(0).repositoryFileErrors).toEqual([
      {
        code: "CONFIG_UNKNOWN_KEY",
        message: "The file has an unknown key `targetz`.",
        recovery: "Remove it.",
      },
    ]);
  });
});
