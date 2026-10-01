import { describe, expect, it } from "vitest";
import { activityGroupings } from "../activity/index.js";
import { owedGroupings } from "../owed/index.js";
import catalogue from "./catalogue.js";

describe("catalogue", () => {
  it("lists every command of the public surface once", () => {
    expect(catalogue.map(({ name }) => name)).toEqual([
      "owed",
      "activity",
      "finished",
      "show",
      "assign",
      "review",
      "config",
    ]);
  });

  it("gives every command what it answers, one example of itself, and the three exit codes", () => {
    for (const command of catalogue) {
      expect(command.answers).toMatch(/\.$/);
      expect(command.example).toMatch(new RegExp(`^docket ${command.name}\\b`));
      expect(Object.keys(command.exits)).toEqual(["0", "2", "3"]);
    }
  });

  it("offers the closed sets of formats and levels of detail, with their defaults", () => {
    const owed = catalogue.find(({ name }) => name === "owed");
    const flag = (name: string) =>
      owed?.flags.find((entry) => entry.name === name);
    expect(flag("format")?.choices).toEqual(["plain", "llm", "json"]);
    expect(flag("detail")).toMatchObject({
      choices: ["summary", "standard", "detailed"],
      default: "standard",
    });
    expect(flag("max-age")?.default).toBe("300");
  });

  it("defaults each flag with choices to one of them, a grouping to the list's first", () => {
    for (const { flags } of catalogue) {
      for (const flag of flags) {
        if (flag.choices && flag.default !== undefined) {
          expect(flag.choices).toContain(flag.default);
        }
      }
    }
    const by = (name: string) =>
      catalogue
        .find((command) => command.name === name)
        ?.flags.find((flag) => flag.name === "by");
    expect(by("owed")).toMatchObject({
      choices: owedGroupings,
      default: owedGroupings.at(0),
    });
    expect(by("activity")).toMatchObject({
      choices: activityGroupings,
      default: activityGroupings.at(0),
    });
  });

  it("says what each level of detail adds to finished, which has no waits", () => {
    const finished = catalogue.find(({ name }) => name === "finished");
    const detail = finished?.flags.find(({ name }) => name === "detail");
    expect(detail).toMatchObject({
      choices: ["summary", "standard", "detailed"],
      default: "standard",
    });
    expect(detail?.description).toContain(
      "detailed adds when each thread ended, as a date and time",
    );
    expect(detail?.description).not.toMatch(/wait|message|check/);
  });

  it("gives --confirm only to the two writes", () => {
    const confirming = catalogue.filter(({ flags }) =>
      flags.some(({ name }) => name === "confirm"),
    );
    expect(confirming.map(({ name }) => name)).toEqual(["assign", "review"]);
  });
});
