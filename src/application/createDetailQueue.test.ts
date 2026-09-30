import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { thread } from "../testing/facts.js";
import { parserFixDetail } from "../testing/recorded.js";
import createDetailQueue from "./createDetailQueue.js";
import type { DetailReading } from "./createDetailReader.js";

beforeEach(() => {
  vi.useFakeTimers({ now: new Date("2026-09-28T10:00:00Z") });
});

afterEach(() => {
  vi.useRealTimers();
});

const one = thread({ number: 1 });
const two = thread({ number: 2 });
const three = thread({ number: 3 });
const four = thread({ number: 4 });

/** A reader finding every thread but #3, which counts what it is asked. */
const reading = () => ({
  read: vi.fn(
    async (
      threads: readonly (typeof one)[],
      _selected?: typeof one,
    ): Promise<DetailReading> =>
      threads.map((each) => ({
        thread: each,
        detail: each.number === 3 ? undefined : parserFixDetail,
      })),
  ),
});
const open = (reader = reading()) =>
  createDetailQueue(reader, () => new Date());

describe("createDetailQueue", () => {
  it("reads alone a thread asked for with nothing pending, once for its version", async () => {
    const reader = reading();
    const queue = open(reader);
    const first = queue.read(one, "v1");
    expect(queue.read(one, "v1")).toBe(first);
    await vi.advanceTimersByTimeAsync(0);
    expect(await first).toBe(parserFixDetail);
    expect(reader.read).toHaveBeenCalledOnce();
    expect(queue.read(one, "v1")).toBe(first);
    queue.read(one, "v2");
    await vi.advanceTimersByTimeAsync(0);
    expect(reader.read).toHaveBeenCalledTimes(2);
  });

  it("gathers the rows asked for and a read asked for meanwhile into one request once the rest is over, the selected first", async () => {
    const reader = reading();
    const queue = open(reader);
    queue.request(
      [
        { thread: one, version: "v" },
        { thread: two, version: "v" },
      ],
      two,
      200,
    );
    const alone = queue.read(three, "v");
    await vi.advanceTimersByTimeAsync(199);
    expect(reader.read).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(reader.read).toHaveBeenCalledOnce();
    expect(reader.read.mock.calls.at(0)?.[0]).toEqual([two, one, three]);
    expect(reader.read.mock.calls.at(0)?.[1]).toBe(two);
    await expect(alone).rejects.toThrow(
      "example-org/example-repo#3 was not found.",
    );
    expect(await queue.read(one, "v")).toBe(parserFixDetail);
  });

  it("puts the request off while the selection keeps moving", async () => {
    const reader = reading();
    const queue = open(reader);
    queue.request([{ thread: one, version: "v" }], one, 200);
    await vi.advanceTimersByTimeAsync(150);
    queue.request([{ thread: two, version: "v" }], two, 200);
    await vi.advanceTimersByTimeAsync(150);
    expect(reader.read).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(50);
    expect(reader.read).toHaveBeenCalledOnce();
  });

  it("reads the window where the selection rests, and lets the windows it passed through fall due again", async () => {
    const reader = reading();
    const queue = open(reader);
    const windowOf = (...threads: (typeof one)[]) =>
      threads.map((each) => ({ thread: each, version: "v" }));
    queue.request(windowOf(one, two), one, 200);
    await vi.advanceTimersByTimeAsync(50);
    queue.request(windowOf(two, three), two, 200);
    await vi.advanceTimersByTimeAsync(50);
    queue.request(windowOf(three, four), four, 200);
    await vi.advanceTimersByTimeAsync(200);
    expect(reader.read).toHaveBeenCalledOnce();
    expect(reader.read.mock.calls.at(0)?.[0]).toEqual([four, three]);
    expect(queue.isDue(one, "v", new Date())).toBe(true);
    expect(queue.isDue(two, "v", new Date())).toBe(true);
    expect(queue.isDue(four, "v", new Date())).toBe(false);
  });

  it("lets a thread fall due again whatever version its dropped asks were at", async () => {
    const reader = reading();
    const queue = open(reader);
    queue.request([{ thread: one, version: "v1" }], one, 200);
    queue.request([{ thread: one, version: "v2" }], one, 200);
    queue.request([{ thread: two, version: "v" }], two, 200);
    await vi.advanceTimersByTimeAsync(200);
    expect(reader.read.mock.calls.at(0)?.[0]).toEqual([two]);
    expect(queue.isDue(one, "v2", new Date())).toBe(true);
  });

  it("keeps a read given out when the selection moves on", async () => {
    const reader = reading();
    const queue = open(reader);
    queue.request([{ thread: one, version: "v" }], one, 200);
    const given = queue.read(one, "v");
    queue.request([{ thread: two, version: "v" }], two, 200);
    await vi.advanceTimersByTimeAsync(200);
    expect(reader.read.mock.calls.at(0)?.[0]).toEqual([two, one]);
    expect(await given).toBe(parserFixDetail);
  });

  it("sends nothing when nothing in the window is due", async () => {
    const reader = reading();
    const queue = open(reader);
    queue.request([{ thread: one, version: "v" }], one, 0);
    await vi.advanceTimersByTimeAsync(0);
    queue.request([{ thread: one, version: "v" }], one, 200);
    await vi.advanceTimersByTimeAsync(200);
    expect(reader.read).toHaveBeenCalledOnce();
  });

  it("counts each arrival, telling its listeners, and says details are due once 30 seconds old or for another version", async () => {
    const queue = open();
    const listener = vi.fn();
    queue.subscribe(listener);
    expect(queue.isDue(one, "v", new Date())).toBe(true);
    queue.request([{ thread: one, version: "v" }], one, 0);
    expect(queue.isDue(one, "v", new Date())).toBe(false);
    await vi.advanceTimersByTimeAsync(0);
    expect(queue.countArrivals(one)).toBe(1);
    expect(queue.countArrivals(two)).toBe(0);
    expect(listener).toHaveBeenCalledTimes(2);
    expect(queue.isDue(one, "v", new Date())).toBe(false);
    expect(queue.isDue(one, "w", new Date())).toBe(true);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(queue.isDue(one, "v", new Date())).toBe(true);
  });

  it("asks again for a thread the budget left out, and fails every read of a request that fails, so each is read again", async () => {
    const reader = {
      read: vi.fn(async (): Promise<DetailReading> => []),
    };
    const queue = open(reader);
    queue.request([{ thread: two, version: "v" }], undefined, 0);
    await vi.advanceTimersByTimeAsync(0);
    expect(queue.isDue(two, "v", new Date())).toBe(true);
    reader.read.mockRejectedValueOnce(new Error("offline"));
    const failed = queue.read(one, "v");
    await vi.advanceTimersByTimeAsync(0);
    await expect(failed).rejects.toThrow("offline");
    expect(queue.read(one, "v")).not.toBe(failed);
  });

  it("asks again for a thread no longer found, or whose request failed, only once its version moves or a read asks for it", async () => {
    const reader = reading();
    const queue = open(reader);
    const window = [
      { thread: two, version: "v" },
      { thread: three, version: "v" },
    ];
    queue.request(window, two, 200);
    await vi.advanceTimersByTimeAsync(200);
    reader.read.mockRejectedValueOnce(new Error("offline"));
    queue.request([...window, { thread: one, version: "v" }], one, 200);
    await vi.advanceTimersByTimeAsync(200);
    expect(reader.read).toHaveBeenCalledTimes(2);
    for (let rest = 0; rest < 3; rest += 1) {
      queue.request([...window, { thread: one, version: "v" }], one, 200);
      await vi.advanceTimersByTimeAsync(200);
    }
    expect(reader.read).toHaveBeenCalledTimes(2);
    expect(queue.isDue(three, "w", new Date())).toBe(true);
    expect(queue.isDue(one, "w", new Date())).toBe(true);
    const again = queue.read(one, "v");
    await vi.advanceTimersByTimeAsync(0);
    expect(await again).toBe(parserFixDetail);
    expect(reader.read).toHaveBeenCalledTimes(3);
    expect(reader.read.mock.calls.at(2)?.[0]).toEqual([one]);
  });

  it("reads a thread asked for twice once, at the version asked last", async () => {
    const reader = reading();
    const queue = open(reader);
    const listener = vi.fn();
    queue.subscribe(listener)();
    queue.read(one, "v1");
    const later = queue.read(one, "v2");
    await vi.advanceTimersByTimeAsync(0);
    expect(reader.read.mock.calls.at(0)?.[0]).toEqual([one]);
    expect(await later).toBe(parserFixDetail);
    expect(queue.countArrivals(one)).toBe(1);
    expect(listener).not.toHaveBeenCalled();
  });

  it("keeps a read asked for while an older one is under way, whether the older arrives or fails, and counts only the newer", async () => {
    const answers: (() => void)[] = [];
    const reader = {
      read: vi.fn(
        (threads: readonly (typeof one)[]) =>
          new Promise<DetailReading>((resolve, reject) =>
            answers.push(() =>
              threads.some(({ number }) => number === 2)
                ? reject(new Error("offline"))
                : resolve(
                    threads.map((each) => ({
                      thread: each,
                      detail: parserFixDetail,
                    })),
                  ),
            ),
          ),
      ),
    };
    const queue = open(reader);
    queue.read(one, "v1");
    await vi.advanceTimersByTimeAsync(0);
    const newer = queue.read(one, "v2");
    answers.shift()?.();
    await vi.advanceTimersByTimeAsync(0);
    expect(queue.countArrivals(one)).toBe(0);
    answers.shift()?.();
    expect(await newer).toBe(parserFixDetail);
    expect(queue.countArrivals(one)).toBe(1);
    queue.read(two, "v1");
    await vi.advanceTimersByTimeAsync(0);
    const replaced = queue.read(two, "v2");
    answers.shift()?.();
    await vi.advanceTimersByTimeAsync(0);
    answers.shift()?.();
    await expect(replaced).rejects.toThrow("offline");
  });

  it("sends nothing while paused, and what waits once it is not", async () => {
    const reader = reading();
    const queue = open(reader);
    queue.request([{ thread: one, version: "v" }], one, 200);
    queue.pause(true);
    const alone = queue.read(two, "v");
    await vi.advanceTimersByTimeAsync(1_000);
    expect(reader.read).not.toHaveBeenCalled();
    queue.pause(false);
    await vi.advanceTimersByTimeAsync(0);
    expect(reader.read).toHaveBeenCalledOnce();
    expect(reader.read.mock.calls.at(0)?.[0]).toEqual([one, two]);
    expect(await alone).toBe(parserFixDetail);
    queue.pause(false);
    await vi.advanceTimersByTimeAsync(0);
    expect(reader.read).toHaveBeenCalledOnce();
  });

  it("sends nothing once stopped", async () => {
    const reader = reading();
    const queue = open(reader);
    queue.request([{ thread: one, version: "v" }], one, 200);
    queue.stop();
    await vi.advanceTimersByTimeAsync(1_000);
    expect(reader.read).not.toHaveBeenCalled();
  });
});

/** A reader whose every request waits until the test answers it. */
const waiting = () => {
  const answers: (() => void)[] = [];
  const reader = {
    read: vi.fn(
      (threads: readonly (typeof one)[]): Promise<DetailReading> =>
        new Promise((resolve) =>
          answers.push(() =>
            resolve(
              threads.map((each) => ({
                thread: each,
                detail: each.number === 3 ? undefined : parserFixDetail,
              })),
            ),
          ),
        ),
    ),
  };
  return { reader, answer: () => answers.shift()?.() };
};
const wanted = (...threads: (typeof one)[]) =>
  threads.map((each) => ({ thread: each, version: "v" }));

describe("createDetailQueue's count of details", () => {
  it("counts the threads asked for with nothing pending, and those answered, found or not, until nothing is pending", async () => {
    const { reader, answer } = waiting();
    const queue = open(reader);
    expect(queue.countDetails()).toBeUndefined();
    queue.request(wanted(one, two, three), one, 0);
    expect(queue.countDetails()).toEqual({ read: 0, asked: 3 });
    await vi.advanceTimersByTimeAsync(0);
    queue.read(four, "v");
    expect(queue.countDetails()).toEqual({ read: 0, asked: 4 });
    answer();
    await vi.advanceTimersByTimeAsync(0);
    expect(queue.countDetails()).toEqual({ read: 3, asked: 4 });
    answer();
    await vi.advanceTimersByTimeAsync(0);
    expect(queue.countDetails()).toBeUndefined();
  });

  it("counts the selected thread alone when only its details are read again", async () => {
    const { reader, answer } = waiting();
    const queue = open(reader);
    queue.request(wanted(one, two), one, 0);
    await vi.advanceTimersByTimeAsync(0);
    answer();
    await vi.advanceTimersByTimeAsync(0);
    queue.read(one, "w");
    expect(queue.countDetails()).toEqual({ read: 0, asked: 1 });
  });

  it("no longer counts a thread that gives way to a later window, or that a request leaves out", async () => {
    const reader = { read: vi.fn(async (): Promise<DetailReading> => []) };
    const queue = open(reader);
    queue.request(wanted(one, two), one, 200);
    queue.request(wanted(two), two, 200);
    expect(queue.countDetails()).toEqual({ read: 0, asked: 1 });
    queue.read(three, "v");
    await vi.advanceTimersByTimeAsync(200);
    expect(queue.countDetails()).toBeUndefined();
  });

  it("ends the count when the window asks for nothing more, with nothing sent", () => {
    const queue = open();
    queue.request(wanted(one), one, 200);
    queue.request([], undefined, 200);
    expect(queue.countDetails()).toBeUndefined();
  });

  it("counts nothing while paused, and takes the count up again once it is not", async () => {
    const queue = open();
    queue.request(wanted(one, two), one, 200);
    queue.pause(true);
    expect(queue.countDetails()).toBeUndefined();
    queue.pause(false);
    expect(queue.countDetails()).toEqual({ read: 0, asked: 2 });
    await vi.advanceTimersByTimeAsync(0);
    expect(queue.countDetails()).toBeUndefined();
  });

  it("tells its listeners when the count opens, moves and ends, and not when it stays", async () => {
    const { reader, answer } = waiting();
    const queue = open(reader);
    const listener = vi.fn();
    queue.subscribe(listener);
    queue.request(wanted(one), one, 0);
    queue.request(wanted(one), one, 0);
    expect(listener).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(0);
    answer();
    await vi.advanceTimersByTimeAsync(0);
    expect(listener).toHaveBeenCalledTimes(2);
    queue.pause(true);
    queue.pause(true);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("counts nothing once stopped", () => {
    const queue = open();
    queue.request(wanted(one), one, 200);
    queue.stop();
    expect(queue.countDetails()).toBeUndefined();
  });
});

/**
 * A reader whose every request waits until the test settles it, the
 * oldest first: with the details found for the threads `settle` keeps,
 * or failing with `reason`.
 */
const held = () => {
  const pending: {
    readonly threads: readonly (typeof one)[];
    readonly resolve: (reading: DetailReading) => void;
    readonly reject: (reason: unknown) => void;
  }[] = [];
  const reader = {
    read: vi.fn(
      (threads: readonly (typeof one)[]) =>
        new Promise<DetailReading>((resolve, reject) =>
          pending.push({ threads, resolve, reject }),
        ),
    ),
  };
  const next = () => {
    const first = pending.shift();
    if (!first) throw new Error("no request is pending");
    return first;
  };
  return {
    reader,
    answer: (keep: (thread: typeof one) => boolean) => {
      const { threads, resolve } = next();
      resolve(
        threads
          .filter(keep)
          .map((each) => ({ thread: each, detail: parserFixDetail })),
      );
    },
    fail: (reason: unknown) => next().reject(reason),
  };
};

/** Two requests under way: `one` and `two` read ahead, then `four` alone. */
async function overlap(reader: ReturnType<typeof held>["reader"]) {
  const queue = open(reader);
  queue.request(wanted(one, two), one, 0);
  await vi.advanceTimersByTimeAsync(0);
  void queue.read(four, "v").catch(() => {});
  await vi.advanceTimersByTimeAsync(0);
  expect(reader.read).toHaveBeenCalledTimes(2);
  return queue;
}

describe("createDetailQueue's count of details while requests overlap", () => {
  it("stops counting as asked a thread the reader left out", async () => {
    const { reader, answer } = held();
    const queue = await overlap(reader);
    answer((each) => each.number === 1);
    await vi.advanceTimersByTimeAsync(0);
    expect(queue.countDetails()).toEqual({ read: 1, asked: 2 });
  });

  it("counts as answered each thread of a request that failed", async () => {
    const { reader, fail } = held();
    const queue = await overlap(reader);
    fail(new Error("offline"));
    await vi.advanceTimersByTimeAsync(0);
    expect(queue.countDetails()).toEqual({ read: 2, asked: 3 });
  });

  it("counts again as unread a thread asked for at a new version after its answer", async () => {
    const { reader, answer } = held();
    const queue = await overlap(reader);
    answer(() => true);
    await vi.advanceTimersByTimeAsync(0);
    expect(queue.countDetails()).toEqual({ read: 2, asked: 3 });
    void queue.read(one, "w");
    expect(queue.countDetails()).toEqual({ read: 1, asked: 3 });
  });
});
