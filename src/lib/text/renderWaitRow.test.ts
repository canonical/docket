import { describe, expect, it } from "vitest";
import { recordedOwed } from "../../testing/recorded.js";
import renderWaitRow from "./renderWaitRow.js";

const [first, , soon] = recordedOwed().groups.at(0)?.rows ?? [];
if (!first || !soon) throw new Error("the recording has waits");

describe("renderWaitRow", () => {
  it("gives an agent one complete line, the title and the author quoted and the due time absolute", () => {
    expect(renderWaitRow(soon, "llm", "Europe/Paris", "standard")).toEqual([
      '- example#15 · "Crash on start" · reply · author "carol" (internal) · unassigned · 4h left, due soon · due 2026-09-28 16:00 Europe/Paris',
    ]);
  });

  it("gives a person the reference line, the title, then the owners and marks", () => {
    expect(renderWaitRow(first, "plain", "Europe/Paris", "standard")).toEqual([
      "example#12 · reply · 4d over",
      "  Fix the parser",
      "  alice · checks failing · example stack 3, 2 of 3",
    ]);
  });

  it("adds when the wait started and its target at the detailed level", () => {
    expect(renderWaitRow(first, "plain", "UTC", "detailed").at(3)).toBe(
      "  since 2026-09-21 08:00 UTC · target 24h · due 2026-09-22 08:00 UTC",
    );
    expect(renderWaitRow(first, "llm", "UTC", "detailed").at(0)).toMatch(
      / · waiting since 2026-09-21 08:00 UTC · target 24h$/,
    );
  });

  it("marks a draft", () => {
    const draft = {
      ...first,
      draft: { text: "draft", fit: "trimmed" },
    } as const;
    expect(renderWaitRow(draft, "plain", "UTC", "standard").at(2)).toBe(
      "  alice · draft · checks failing · example stack 3, 2 of 3",
    );
  });

  it("marks a row of a repository whose own file is invalid, for a person and an agent", () => {
    const marked = {
      ...soon,
      invalidFile: { text: "invalid repository file", fit: "trimmed" },
    } as const;
    expect(renderWaitRow(marked, "plain", "UTC", "standard").at(2)).toBe(
      "  unassigned · invalid repository file",
    );
    expect(renderWaitRow(marked, "llm", "UTC", "standard").at(0)).toMatch(
      / · due 2026-09-28 14:00 UTC · invalid repository file$/,
    );
  });
});
