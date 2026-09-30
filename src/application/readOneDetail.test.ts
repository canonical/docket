import { describe, expect, it, vi } from "vitest";
import { thread } from "../testing/facts.js";
import { parserFixDetail } from "../testing/recorded.js";
import createDetailReader from "./createDetailReader.js";
import readOneDetail from "./readOneDetail.js";

const belowFloor = () => true;

describe("readOneDetail", () => {
  it("gives the thread's details, read as one request, even below the budget floor", async () => {
    const readDetails = vi.fn(async () => [parserFixDetail]);
    expect(
      await readOneDetail(
        createDetailReader(readDetails, belowFloor),
        thread(),
      ),
    ).toBe(parserFixDetail);
    expect(readDetails).toHaveBeenCalledWith([thread()]);
  });

  it("fails naming a thread the provider no longer finds", async () => {
    const reader = createDetailReader(async () => [undefined], belowFloor);
    await expect(readOneDetail(reader, thread())).rejects.toThrow(
      "example-org/example-repo#1 was not found.",
    );
  });
});
