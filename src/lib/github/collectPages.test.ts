import { describe, expect, it } from "vitest";
import { page } from "../../testing/github.js";
import collectPages from "./collectPages.js";

describe("collectPages", () => {
  it("collects every node, asking for each page after the last cursor", async () => {
    const asked: (string | null)[] = [];
    const pages = [page(["a"], "c1"), page(["b", "c"], "c2"), page(["d"])];
    const nodes = await collectPages(async (after) => {
      asked.push(after);
      return pages[asked.length - 1];
    });
    expect(nodes).toEqual(["a", "b", "c", "d"]);
    expect(asked).toEqual([null, "c1", "c2"]);
  });

  it("collects nothing from a list that is missing", async () => {
    expect(await collectPages(async () => undefined)).toEqual([]);
  });
});
