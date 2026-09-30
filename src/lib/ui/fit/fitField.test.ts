import { describe, expect, it } from "vitest";
import type { FieldKind } from "../../owed/index.js";
import { fitRules } from "./constants.js";
import fitField from "./fitField.js";
import measureText from "./measureText.js";

/** A text of each kind, longer than 40 cells, as a list would give it. */
const samples: Readonly<Record<FieldKind, string>> = {
  identifier: "example-repository-with-a-very-long-name#12345",
  person: "example-org/a-team-with-a-very-long-name-indeed",
  title: "Fix the parser so it keeps comments at the ends of lines",
  quote: "Could you look at the parser again once the tests are green?",
  words: "requested review from every owner of the repository",
  reason: "GitHub gave no answer within 30 seconds, so nothing was read",
  recovery: "check the network connection and https://www.githubstatus.com",
  figure: "12345w over by far and more",
};

/** What each kind becomes on one line, on an event's line and in a block, at 40 and 60 cells. */
const table: Readonly<
  Record<
    FieldKind,
    Record<
      40 | 60,
      {
        readonly line: string;
        readonly event: string;
        readonly block: string[];
      }
    >
  >
> = {
  identifier: {
    40: {
      line: "example-repository-…very-long-name#12345",
      event: "example-repository-…very-long-name#12345",
      block: ["example-repository-with-a-very-long-name", "#12345"],
    },
    60: {
      line: "example-repository-with-a-very-long-name#12345",
      event: "example-repository-with-a-very-long-name#12345",
      block: ["example-repository-with-a-very-long-name#12345"],
    },
  },
  person: {
    40: {
      line: "a-team-with-a-very-long-name-indeed",
      event: "a-team-with-a-very-long-name-indeed",
      block: ["example-org/a-team-with-a-very-long-name-indeed"],
    },
    60: {
      line: "a-team-with-a-very-long-name-indeed",
      event: "a-team-with-a-very-long-name-indeed",
      block: ["example-org/a-team-with-a-very-long-name-indeed"],
    },
  },
  title: {
    40: {
      line: "Fix the parser so it keeps comments at …",
      event: "Fix the parser so it keeps comments at …",
      block: ["Fix the parser so it keeps comments at", "the ends of lines"],
    },
    60: {
      line: "Fix the parser so it keeps comments at the ends of lines",
      event: "Fix the parser so it keeps comments at the ends of lines",
      block: ["Fix the parser so it keeps comments at the ends of lines"],
    },
  },
  quote: {
    40: {
      line: "Could you look at the parser again once…",
      event: "Could you look at the parser again once…",
      block: [
        "Could you look at the parser again once",
        "the tests are green?",
      ],
    },
    60: {
      line: "Could you look at the parser again once the tests are green?",
      event: "Could you look at the parser again once the tests are green?",
      block: ["Could you look at the parser again once the tests are green?"],
    },
  },
  words: {
    40: {
      line: "requested review from every owner of th…",
      event: "requested review fr…er of the repository",
      block: ["requested review from every owner of the", "repository"],
    },
    60: {
      line: "requested review from every owner of the repository",
      event: "requested review from every owner of the repository",
      block: ["requested review from every owner of the repository"],
    },
  },
  reason: {
    40: {
      line: "GitHub gave no answer within 30 seconds…",
      event: "GitHub gave no answer within 30 seconds…",
      block: [
        "GitHub gave no answer within 30 seconds,",
        "so nothing was read",
      ],
    },
    60: {
      line: "GitHub gave no answer within 30 seconds, so nothing was read",
      event: "GitHub gave no answer within 30 seconds, so nothing was read",
      block: ["GitHub gave no answer within 30 seconds, so nothing was read"],
    },
  },
  recovery: {
    40: {
      line: "check the network connection and https:…",
      event: "check the network connection and https:…",
      block: [
        "check the network connection and",
        "https://www.githubstatus.com",
      ],
    },
    60: {
      line: "check the network connection and https://www.githubstatus.c…",
      event: "check the network connection and https://www.githubstatus.c…",
      block: [
        "check the network connection and",
        "https://www.githubstatus.com",
      ],
    },
  },
  figure: {
    40: {
      line: "12345w over by far and more",
      event: "12345w over by far and more",
      block: ["12345w over by far and more"],
    },
    60: {
      line: "12345w over by far and more",
      event: "12345w over by far and more",
      block: ["12345w over by far and more"],
    },
  },
};

describe("fitField", () => {
  it("has a rule for every kind of field", () => {
    expect(Object.keys(fitRules).sort()).toEqual(Object.keys(samples).sort());
  });

  for (const kind of Object.keys(samples) as FieldKind[]) {
    for (const cells of [40, 60] as const) {
      it(`fits a ${kind} to a line, an event and a block of ${cells} cells by its rule`, () => {
        const field = { text: samples[kind], kind };
        expect({
          line: fitField(field, "line", cells),
          event: fitField(field, "event", cells),
          block: fitField(field, "block", cells),
        }).toEqual(table[kind][cells]);
      });
    }
  }

  it("never lets a line pass its cells, unless the rule keeps the field whole", () => {
    for (const kind of Object.keys(samples) as FieldKind[]) {
      const line = fitField({ text: samples[kind], kind }, "line", 40);
      if (fitRules[kind].line !== "whole") {
        expect(measureText(line)).toBeLessThanOrEqual(40);
      }
    }
  });

  it("removes control sequences from every slot", () => {
    const field = { text: "Fix\u001b[2J it", kind: "title" as const };
    expect(fitField(field, "line", 40)).toBe("Fix it");
    expect(fitField(field, "block", 40)).toEqual(["Fix it"]);
    expect(fitField({ ...field, kind: "figure" }, "line", 40)).toBe("Fix it");
    expect(fitField({ ...field, kind: "person" }, "block", 40)).toEqual([
      "Fix it",
    ]);
  });
});
