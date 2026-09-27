import { describe, expect, it } from "vitest";
import describeOwners from "./describeOwners.js";

describe("describeOwners", () => {
  it("names nobody assigned as unassigned", () => {
    expect(describeOwners([])).toEqual({
      owner: { text: "unassigned", fit: "trimmed" },
    });
  });

  it("names one owner on the row, whole however long the login", () => {
    expect(describeOwners(["alice"])).toEqual({
      owner: { text: "alice", fit: "trimmed" },
    });
    const long = "a-very-long-login-name-indeed";
    expect(describeOwners([long])).toEqual({
      owner: { text: long, fit: "trimmed" },
    });
  });

  it("lists two or more owners on a wrapped line of their own", () => {
    expect(describeOwners(["alice", "bob"])).toEqual({
      owners: {
        fit: "wrapped",
        fields: [
          { text: "alice", fit: "trimmed" },
          { text: "bob", fit: "trimmed" },
        ],
      },
    });
  });
});
