import { describe, expect, it, vi } from "vitest";
import { thread } from "../testing/facts.js";
import { parserFixDetail } from "../testing/recorded.js";
import createDetailReader from "./createDetailReader.js";

const threads = Array.from({ length: 20 }, (_, index) =>
  thread({ number: index + 1 }),
);
const alwaysReadAhead = () => true;

/** Reads every thread's details, as one request, finding all but #13. */
const readAll = () =>
  vi.fn(async (asked: readonly { number: number }[]) =>
    asked.map(({ number }) => (number === 13 ? undefined : parserFixDetail)),
  );

describe("createDetailReader", () => {
  it("reads at most 14 threads in one request, each with its details or none", async () => {
    const readDetails = readAll();
    const read = await createDetailReader(readDetails, alwaysReadAhead).read(
      threads,
      undefined,
    );
    expect(readDetails).toHaveBeenCalledOnce();
    expect(read).toHaveLength(14);
    expect(read.at(0)).toEqual({
      thread: threads.at(0),
      detail: parserFixDetail,
    });
    expect(read.at(12)?.detail).toBeUndefined();
  });

  it("asks nothing when given nothing to read", async () => {
    const readDetails = readAll();
    expect(
      await createDetailReader(readDetails, alwaysReadAhead).read(
        [],
        undefined,
      ),
    ).toEqual([]);
    expect(readDetails).not.toHaveBeenCalled();
  });

  it("reads only the selected thread below the budget floor, as the floor stands at each request", async () => {
    const readDetails = readAll();
    let ahead = false;
    const reader = createDetailReader(readDetails, () => ahead);
    const [first, second] = threads;
    const floored = await reader.read(threads.slice(0, 3), second);
    expect(floored.map(({ thread: read }) => read)).toEqual([second]);
    expect(await reader.read([first], undefined)).toEqual([]);
    expect(readDetails).toHaveBeenCalledOnce();
    ahead = true;
    expect(await reader.read(threads.slice(0, 3), second)).toHaveLength(3);
  });
});
