import { describe, expect, it } from "vitest";
import { personalFile, repositoryFile } from "../../testing/fixtures.js";
import { builtInSettings } from "./constants.js";
import parseFile from "./parseFile.js";
import resolveSettings from "./resolveSettings.js";
import type { FileOutcome, Layer } from "./types.js";

const layerOf = (outcome: FileOutcome): Layer => {
  if (!outcome.ok) throw new Error("the fixture is invalid");
  return outcome.layer;
};
const personal = layerOf(parseFile(personalFile, "personal"));
const repository = parseFile(repositoryFile, "repository");
const invalidRepository = parseFile(
  "version: 1\npeople: [carol]\n",
  "repository",
);

describe("resolveSettings", () => {
  it("uses the built-in defaults when no file exists", () => {
    const resolved = resolveSettings(undefined, undefined);
    expect(resolved.settings).toEqual(builtInSettings);
    expect(Object.values(resolved.origins)).toEqual(Array(8).fill("built-in"));
    expect(resolved.repositoryErrors).toEqual([]);
  });

  it("uses every section the personal file declares", () => {
    const { settings, origins } = resolveSettings(personal, undefined);
    expect(settings.time).toEqual({
      workdays: ["mon", "tue", "wed", "thu", "fri"],
      timezone: "Europe/Paris",
    });
    expect(settings.targets.close.issue).toEqual({ amount: 20, unit: "d" });
    expect(settings.repos.map((repo) => repo.name)).toEqual([
      "example",
      "docs",
    ]);
    expect(Object.values(origins)).toEqual(Array(8).fill("personal"));
  });

  it("gives the repository file the whole of each section it declares", () => {
    const { settings, origins } = resolveSettings(personal, repository);
    expect(settings.people).toEqual(new Map([["carol", "team"]]));
    expect(origins.people).toBe("repository");
    expect(origins.targets).toBe("repository");
  });

  it("fills keys a repository section leaves out from the built-in defaults, not the personal file", () => {
    const { settings } = resolveSettings(personal, repository);
    expect(settings.targets).toEqual({
      nextMove: builtInSettings.targets.nextMove,
      close: {
        ...builtInSettings.targets.close,
        issue: { amount: 10, unit: "d" },
      },
    });
  });

  it("keeps the personal file's sections that the repository file leaves out", () => {
    const { settings, origins } = resolveSettings(personal, repository);
    expect(settings.time.timezone).toBe("Europe/Paris");
    expect(origins.time).toBe("personal");
    expect(settings.activity).toEqual(personal.activity);
  });

  it("fills keys a personal section leaves out from the built-in defaults", () => {
    const partial = layerOf(
      parseFile(
        "version: 1\ntime: { timezone: Europe/Paris }\nexempt: {}\n",
        "personal",
      ),
    );
    const { settings } = resolveSettings(partial, undefined);
    expect(settings.time.workdays).toEqual(builtInSettings.time.workdays);
    expect(settings.exempt).toEqual(builtInSettings.exempt);
  });

  it("falls back to the built-in defaults for an invalid repository file, and marks it", () => {
    const { settings, origins, repositoryErrors } = resolveSettings(
      personal,
      invalidRepository,
    );
    expect(repositoryErrors.map((error) => error.code)).toEqual([
      "CONFIG_WRONG_TYPE",
    ]);
    expect(settings.people).toEqual(builtInSettings.people);
    expect(settings.time).toEqual(builtInSettings.time);
    expect(settings.targets).toEqual(builtInSettings.targets);
    expect(settings.exempt).toEqual(builtInSettings.exempt);
    expect(origins.time).toBe("built-in");
  });

  it("keeps the personal-only sections when the repository file is invalid", () => {
    const { settings, origins } = resolveSettings(personal, invalidRepository);
    expect(settings.repos).toEqual(personal.repos);
    expect(settings.activity).toEqual(personal.activity);
    expect(settings.you).toEqual({ teams: ["example-org/ui"] });
    expect(origins.hosts).toBe("personal");
    expect(origins.you).toBe("personal");
  });

  it("names none of your teams unless the personal file lists them", () => {
    const partial = layerOf(parseFile("version: 1\nyou: {}\n", "personal"));
    expect(resolveSettings(partial, undefined).settings.you).toEqual({
      teams: [],
    });
  });
});
