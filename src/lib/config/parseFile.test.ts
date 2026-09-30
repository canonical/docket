import { describe, expect, it } from "vitest";
import { personalFile, repositoryFile } from "../../testing/fixtures.js";
import parseFile from "./parseFile.js";
import type { ConfigErrorCode, FileOutcome } from "./types.js";

/** The error codes a file produces, in order. */
const codesOf = (outcome: FileOutcome) =>
  outcome.ok ? [] : outcome.errors.map((error) => error.code);

const personal = (body: string) => parseFile(`version: 1\n${body}`, "personal");

const refuses = (body: string, ...codes: ConfigErrorCode[]) => {
  expect(codesOf(personal(body))).toEqual(codes);
};

describe("parseFile", () => {
  describe("a whole file", () => {
    it("reads every section of a personal file", () => {
      expect(parseFile(personalFile, "personal")).toEqual({
        ok: true,
        layer: {
          repos: [
            {
              name: "example",
              repo: "example-org/example-repo",
              tags: ["core"],
            },
            { name: "docs", repo: "example-org/example-docs", tags: [] },
          ],
          people: new Map([
            ["alice", "team"],
            ["bob", "team"],
            ["example-sync", "bot"],
          ]),
          time: {
            workdays: ["mon", "tue", "wed", "thu", "fri"],
            timezone: "Europe/Paris",
          },
          targets: {
            nextMove: {
              response: { amount: 8, unit: "h" },
              review: { amount: 1, unit: "d" },
            },
            close: {
              issue: { amount: 20, unit: "d" },
              pullRequest: { amount: 3, unit: "d" },
              discussion: { amount: 1, unit: "w" },
            },
          },
          exempt: { close: ["Topic: roadmap", "announcement"] },
          activity: [
            { amount: 24, unit: "h" },
            { amount: 1, unit: "w" },
          ],
          hosts: ["github.com"],
          you: { teams: ["example-org/ui"] },
        },
      });
    });

    it("keeps only the sections and keys a file declares", () => {
      expect(parseFile(repositoryFile, "repository")).toEqual({
        ok: true,
        layer: {
          people: new Map([["carol", "team"]]),
          targets: { close: { issue: { amount: 10, unit: "d" } } },
        },
      });
    });

    it("reads a file that declares only its version", () => {
      expect(parseFile("version: 1\n", "repository")).toEqual({
        ok: true,
        layer: {},
      });
    });

    it("gives every error a named code, a sentence and a recovery line", () => {
      const outcome = personal(
        "people: { alice: lead }\ntime: { workdays: [] }\nhosts: [example.com]\n",
      );
      expect(outcome.ok).toBe(false);
      for (const error of outcome.ok ? [] : outcome.errors) {
        expect(error.code).toMatch(/^CONFIG_[A-Z_]+$/);
        expect(error.message).toMatch(/\.$/);
        expect(error.recovery).not.toBe("");
      }
    });
  });

  describe("the version", () => {
    it("refuses a file that does not start with a version", () => {
      const outcome = parseFile("people: {}\n", "personal");
      expect(outcome).toEqual({
        ok: false,
        errors: [
          {
            code: "CONFIG_UNSUPPORTED_VERSION",
            message: "The file does not say which version it is written in.",
            recovery: "Start the file with `version: 1`.",
          },
        ],
      });
    });

    it("refuses an empty file", () => {
      expect(codesOf(parseFile("", "repository"))).toEqual([
        "CONFIG_UNSUPPORTED_VERSION",
      ]);
    });

    it("refuses any other version without reading the rest", () => {
      const outcome = parseFile("version: 2\nnew-section: {}\n", "personal");
      expect(outcome).toMatchObject({
        ok: false,
        errors: [
          {
            code: "CONFIG_UNSUPPORTED_VERSION",
            message:
              "The file is version `2`, and docket reads only version 1.",
          },
        ],
      });
    });
  });

  describe("YAML", () => {
    it("refuses text that is not YAML, naming the line", () => {
      const outcome = parseFile("version: 1\npeople: [alice\n", "personal");
      expect(codesOf(outcome)).toContain("CONFIG_INVALID_SYNTAX");
      expect(outcome.ok ? "" : outcome.errors[0]?.message).toMatch(/line \d+/);
    });

    it("refuses a key given twice", () => {
      expect(
        codesOf(
          parseFile(
            "version: 1\npeople:\n  alice: team\n  alice: bot\n",
            "personal",
          ),
        ),
      ).toEqual(["CONFIG_DUPLICATE_KEY"]);
    });

    it("refuses a file that expands its aliases without bound", () => {
      const levels = ["a: &a [x, x, x, x, x, x, x, x, x, x]"];
      for (let level = 1; level < 6; level += 1) {
        const alias = `*${String.fromCharCode(96 + level)}`;
        levels.push(
          `${String.fromCharCode(97 + level)}: &${String.fromCharCode(97 + level)} [${Array(10).fill(alias).join(", ")}]`,
        );
      }
      const outcome = parseFile(
        `version: 1\n${levels.join("\n")}\n`,
        "personal",
      );
      expect(codesOf(outcome)).toEqual(["CONFIG_INVALID_SYNTAX"]);
    });
  });

  describe("sections", () => {
    it("refuses a section docket does not know", () => {
      refuses("owners: {}\n", "CONFIG_UNKNOWN_KEY");
    });

    it.each(["repos", "activity", "hosts", "you"])(
      "refuses %s in a repository file",
      (section) => {
        const outcome = parseFile(`version: 1\n${section}: []\n`, "repository");
        expect(codesOf(outcome)).toEqual(["CONFIG_SECTION_NOT_ALLOWED"]);
      },
    );

    it.each(["repos", "people", "time", "targets", "exempt"])(
      "refuses %s when it is not a map",
      (section) => {
        refuses(`${section}: [alice]\n`, "CONFIG_WRONG_TYPE");
      },
    );

    it("refuses a key that is not text", () => {
      refuses("people: { 1234: team }\n", "CONFIG_WRONG_TYPE");
    });
  });

  describe("repos", () => {
    it("refuses a repository not written as owner/name", () => {
      refuses(
        "repos: { example: { repo: example-repo } }\n",
        "CONFIG_INVALID_REPO",
      );
      refuses("repos: { example: { tags: [core] } }\n", "CONFIG_INVALID_REPO");
    });

    it("refuses a short name a thread reference cannot hold", () => {
      refuses(
        "repos: { 'ex#ample': { repo: example-org/example-repo } }\n",
        "CONFIG_INVALID_REPO",
      );
    });

    it("refuses an entry that is not a map, and tags that are not text", () => {
      refuses(
        "repos: { example: example-org/example-repo }\n",
        "CONFIG_WRONG_TYPE",
      );
      refuses(
        "repos: { example: { repo: example-org/example-repo, tags: core } }\n",
        "CONFIG_WRONG_TYPE",
      );
      refuses(
        "repos: { example: { repo: example-org/example-repo, tags: [[core]] } }\n",
        "CONFIG_WRONG_TYPE",
      );
    });
  });

  describe("people", () => {
    it("refuses a group that is not one of the four", () => {
      refuses("people: { alice: maintainer }\n", "CONFIG_UNKNOWN_GROUP");
    });

    it("refuses one login given two groups under two spellings", () => {
      const outcome = personal("people: { alice: team, Alice: bot }\n");
      expect(outcome).toMatchObject({
        ok: false,
        errors: [{ code: "CONFIG_DUPLICATE_KEY" }],
      });
      expect(outcome.ok ? "" : outcome.errors[0]?.message).toContain("`Alice`");
    });

    it("keys logins in lower case", () => {
      expect(personal("people: { Alice: team }\n")).toEqual({
        ok: true,
        layer: { people: new Map([["alice", "team"]]) },
      });
    });
  });

  describe("time", () => {
    it("reads the time zone alone", () => {
      expect(personal("time: { timezone: Europe/Paris }\n")).toEqual({
        ok: true,
        layer: { time: { timezone: "Europe/Paris" } },
      });
    });

    it("refuses a name that is not a time zone", () => {
      refuses(
        "time: { timezone: Europe/Nowhere }\n",
        "CONFIG_UNKNOWN_TIMEZONE",
      );
      refuses("time: { timezone: 2 }\n", "CONFIG_UNKNOWN_TIMEZONE");
    });

    it("refuses a day that is not a day", () => {
      refuses("time: { workdays: [mon, funday] }\n", "CONFIG_UNKNOWN_WORKDAY");
    });

    it("refuses a day listed twice, naming the day", () => {
      expect(personal("time: { workdays: [mon, tue, mon] }\n")).toEqual({
        ok: false,
        errors: [
          {
            code: "CONFIG_DUPLICATE_WORKDAY",
            message: "`time.workdays` lists `mon` twice.",
            recovery: "Keep one `mon` in `time.workdays`.",
          },
        ],
      });
    });

    it("refuses workdays that list no day", () => {
      refuses("time: { workdays: [] }\n", "CONFIG_EMPTY_LIST");
    });

    it("refuses workdays that are not a list", () => {
      refuses("time: { workdays: mon }\n", "CONFIG_WRONG_TYPE");
    });

    it("refuses a key the section does not have", () => {
      refuses("time: { holidays: [] }\n", "CONFIG_UNKNOWN_KEY");
    });
  });

  describe("targets", () => {
    it("refuses a kind of wait or thread docket does not know", () => {
      refuses("targets: { next-move: { reply: 24h } }\n", "CONFIG_UNKNOWN_KEY");
      refuses("targets: { close: { draft: 5d } }\n", "CONFIG_UNKNOWN_KEY");
      refuses("targets: { respond: { review: 2d } }\n", "CONFIG_UNKNOWN_KEY");
    });

    it("refuses a badly formed duration", () => {
      refuses("targets: { close: { issue: 30 } }\n", "CONFIG_INVALID_DURATION");
      refuses(
        "targets: { next-move: { review: 2 days } }\n",
        "CONFIG_INVALID_DURATION",
      );
    });

    it("refuses a duration longer than about five years", () => {
      expect(personal("targets: { close: { issue: 99999999w } }\n")).toEqual({
        ok: false,
        errors: [
          {
            code: "CONFIG_INVALID_DURATION",
            message:
              '`targets.close.issue` is `"99999999w"`, which is longer than docket accepts.',
            recovery:
              "Write a duration no longer than `43800h`, `1825d` or `260w`.",
          },
        ],
      });
      refuses(`activity: [${"9".repeat(400)}h]\n`, "CONFIG_INVALID_DURATION");
      refuses("activity: [43801h]\n", "CONFIG_INVALID_DURATION");
      refuses("activity: [1826d]\n", "CONFIG_INVALID_DURATION");
      refuses("activity: [261w]\n", "CONFIG_INVALID_DURATION");
    });

    it("accepts the longest duration in each unit", () => {
      refuses("activity: [43800h, 1825d, 260w]\n");
    });

    it("refuses a metric that is not a map", () => {
      refuses("targets: { close: 30d }\n", "CONFIG_WRONG_TYPE");
    });
  });

  describe("exempt", () => {
    it("reads a section with no labels for the close metric", () => {
      expect(personal("exempt: {}\n")).toEqual({
        ok: true,
        layer: { exempt: {} },
      });
    });

    it("refuses a metric that takes no exemptions", () => {
      refuses("exempt: { next-move: [announcement] }\n", "CONFIG_UNKNOWN_KEY");
    });

    it("refuses labels that are not a list of text", () => {
      refuses("exempt: { close: announcement }\n", "CONFIG_WRONG_TYPE");
      refuses("exempt: { close: [[announcement]] }\n", "CONFIG_WRONG_TYPE");
    });
  });

  describe("activity", () => {
    it("refuses a window that is not a duration", () => {
      refuses("activity: [24h, 24]\n", "CONFIG_INVALID_DURATION");
    });

    it("refuses a list with no window", () => {
      refuses("activity: []\n", "CONFIG_EMPTY_LIST");
    });

    it("refuses windows that are not a list", () => {
      refuses("activity: 24h\n", "CONFIG_WRONG_TYPE");
    });
  });

  describe("hosts", () => {
    it("refuses any host other than github.com", () => {
      refuses(
        "hosts: [github.com, github.example.com]\n",
        "CONFIG_UNSUPPORTED_HOST",
      );
    });

    it("refuses a list with no host", () => {
      refuses("hosts: []\n", "CONFIG_EMPTY_LIST");
    });

    it("refuses hosts that are not a list", () => {
      refuses("hosts: github.com\n", "CONFIG_WRONG_TYPE");
    });
  });

  describe("you", () => {
    it("refuses a team not written as org/team", () => {
      refuses("you: { teams: [ui] }\n", "CONFIG_INVALID_TEAM");
    });

    it("refuses a key other than teams", () => {
      refuses("you: { login: alice }\n", "CONFIG_UNKNOWN_KEY");
    });

    it("tells a repository file to move the section to the personal file", () => {
      const outcome = parseFile(
        "version: 1\nyou: { teams: [example-org/ui] }\n",
        "repository",
      );
      expect(outcome.ok ? [] : outcome.errors).toEqual([
        {
          code: "CONFIG_SECTION_NOT_ALLOWED",
          message:
            "A repository file declares `you`, which only the personal file may declare.",
          recovery: "Move `you` to the personal file, or remove it.",
        },
      ]);
    });
  });
});

describe("parseFile's messages", () => {
  const firstError = (body: string) => {
    const outcome = personal(body);
    return outcome.ok ? undefined : outcome.errors[0];
  };

  it("shows a map as keys and values, and asks for text", () => {
    expect(firstError("exempt: { close: [ { a: 1 } ] }\n")).toEqual({
      code: "CONFIG_WRONG_TYPE",
      message: '`exempt.close` holds `{ "a": 1 }`, which is not text.',
      recovery: "Write the value as text, not as a list or a map.",
    });
  });

  it("shows a list with its items quoted", () => {
    expect(
      firstError("repos: { example: { repo: [example-org, example-repo] } }\n")
        ?.message,
    ).toBe(
      '`repos.example.repo` is `["example-org", "example-repo"]`, which is not a repository written as owner/name.',
    );
  });

  it("shows a long list by its first entries, and a list inside it by its brackets", () => {
    expect(
      firstError("exempt: { close: [[1, 2, 3, 4, 5, 6, { a: 1 }]] }\n")
        ?.message,
    ).toBe("`exempt.close` holds `[1, 2, 3, 4, 5, …]`, which is not text.");
    expect(
      firstError("exempt: { close: [{ a: [1], b: {}, c: { d: 1 } }] }\n")
        ?.message,
    ).toBe(
      '`exempt.close` holds `{ "a": […], "b": {…}, "c": {…} }`, which is not text.',
    );
    expect(firstError("exempt: { close: [{}] }\n")?.message).toBe(
      "`exempt.close` holds `{}`, which is not text.",
    );
  });

  it("quotes text", () => {
    expect(firstError("time: { timezone: Europe/Nowhere }\n")?.message).toBe(
      '`time.timezone` is `"Europe/Nowhere"`, which is not a time-zone name.',
    );
  });

  it("suggests quoting a value or key written as a number", () => {
    expect(firstError("exempt: { close: [12] }\n")?.recovery).toBe(
      'Quote the value, as in `"12"`.',
    );
    expect(firstError("people: { 1234: team }\n")).toEqual({
      code: "CONFIG_WRONG_TYPE",
      message: "`people` has the key `1234`, which is not text.",
      recovery: 'Quote the key, as in `"1234"`.',
    });
  });

  it("asks for a key written as text when a key is a list", () => {
    expect(firstError("people: { [a, b]: team }\n")?.recovery).toBe(
      "Write the key as text, not as a list or a map.",
    );
  });

  it("says when a repository entry does not name its repository", () => {
    expect(firstError("repos: { example: { tags: [core] } }\n")?.message).toBe(
      "`repos.example` does not say which repository it is.",
    );
  });
});
