import { describe, expect, it } from "vitest";
import { tokens } from "../../tokens/index.js";
import markPerson from "./markPerson.js";

const person = (
  text: string,
  group: "you" | "team" | "internal" | "outside" | "bot",
) => ({
  text,
  kind: "person" as const,
  group,
});

describe("markPerson", () => {
  it("puts each group's mark and a space before the login, in the group's hue", () => {
    expect(
      [
        person("alice", "you"),
        person("bob", "team"),
        person("erin", "internal"),
        person("dave", "outside"),
        person("renovate", "bot"),
      ].map((owner) => markPerson(owner, 12)),
    ).toEqual([
      { text: "◉ alice", fg: tokens["color.text.team"], marked: true },
      { text: "● bob", fg: tokens["color.text.team"], marked: true },
      { text: "◐ erin", fg: tokens["color.text.internal"], marked: true },
      { text: "○ dave", fg: tokens["color.text.outside"], marked: true },
      { text: "■ renovate", fg: tokens["color.text.muted"], marked: true },
    ]);
  });

  it("cuts the login to its cells and keeps the mark whole", () => {
    expect(markPerson(person("example-maintainer", "bot"), 12).text).toBe(
      "■ example-mai…",
    );
  });

  it("draws an owner that names no person as plain text", () => {
    expect(markPerson({ text: "unassigned", kind: "words" }, 12)).toEqual({
      text: "unassigned",
      fg: tokens["color.text"],
    });
  });
});
