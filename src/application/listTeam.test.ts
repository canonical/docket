import { describe, expect, it } from "vitest";
import { recordedWatched } from "../testing/recorded.js";
import listTeam from "./listTeam.js";

describe("listTeam", () => {
  it("gives the logins a repository groups as its team", () => {
    expect(listTeam(recordedWatched(), "example-org/example-repo")).toEqual([
      "alice",
      "bob",
    ]);
  });

  it("gives none for a repository not watched", () => {
    expect(listTeam(recordedWatched(), "example-org/elsewhere")).toEqual([]);
  });
});
