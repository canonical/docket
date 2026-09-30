import { describe, expect, it } from "vitest";
import dropPages from "./dropPages.js";

const repo = "example-org/example-repo";

describe("dropPages", () => {
  it("leaves each stage without the pages it read", () => {
    expect(
      dropPages([
        { repo, stage: { kind: "reading", fetched: 2, total: 3 } },
        { repo, stage: { kind: "done", threads: 4, fetched: 3, total: 3 } },
        { repo, stage: { kind: "waiting" } },
      ]),
    ).toEqual([
      { repo, stage: { kind: "reading" } },
      { repo, stage: { kind: "done", threads: 4 } },
      { repo, stage: { kind: "waiting" } },
    ]);
  });
});
