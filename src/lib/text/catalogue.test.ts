import { describe, expect, it } from "vitest";
import catalogue from "./catalogue.js";

describe("catalogue", () => {
  it("lists every command of the public surface once", () => {
    expect(catalogue.map(({ name }) => name)).toEqual([
      "owed",
      "activity",
      "show",
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
      fallback: "standard",
    });
    expect(flag("max-age")?.fallback).toBe("300");
  });
});
