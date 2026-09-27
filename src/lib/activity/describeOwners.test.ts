import { describe, expect, it } from "vitest";
import describeOwners from "./describeOwners.js";

describe("describeOwners", () => {
  it("names nobody assigned as unassigned", () => {
    expect(describeOwners([])).toEqual({
      owner: { text: "unassigned", fit: "trimmed", cells: 12 },
    });
  });

  it("names one owner on the row, capped at twelve cells", () => {
    expect(describeOwners(["alice"])).toEqual({
      owner: { text: "alice", fit: "trimmed", cells: 12 },
    });
  });

  it("lists two or more owners on a wrapped line of their own, each capped", () => {
    expect(describeOwners(["alice", "bob"])).toEqual({
      owners: {
        fit: "wrapped",
        fields: [
          { text: "alice", fit: "trimmed", cells: 12 },
          { text: "bob", fit: "trimmed", cells: 12 },
        ],
      },
    });
  });
});
