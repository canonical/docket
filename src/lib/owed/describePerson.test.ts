import { describe, expect, it } from "vitest";
import {
  alice,
  carol,
  dave,
  exampleSync,
  teamSettings,
} from "../../testing/facts.js";
import describePerson from "./describePerson.js";

const { people } = teamSettings;

describe("describePerson", () => {
  it("names a login whole, with the group the settings give it", () => {
    expect(describePerson(alice, people, undefined)).toEqual({
      text: "alice",
      fit: "trimmed",
      group: "team",
      viewer: false,
    });
    expect(
      [carol, dave, exampleSync].map(
        (author) => describePerson(author, people, undefined).group,
      ),
    ).toEqual(["internal", "external", "bot"]);
  });

  it("marks the viewer, whatever the case of either login", () => {
    expect(describePerson(alice, people, "Alice").viewer).toBe(true);
    expect(
      describePerson({ ...dave, login: "DAVE" }, people, "dave").viewer,
    ).toBe(true);
    expect(describePerson(carol, people, "alice").viewer).toBe(false);
  });
});
