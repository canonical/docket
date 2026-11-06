/** Run with DOCKET_BENCH=1 bunx --bun vitest run src/testing/navigation.bench.test.tsx --disable-console-intercept. */
import { describe, expect, it } from "vitest";
import type { TerminalMode } from "../application/types.js";
import { holdCache, settleStatus } from "./cache.js";
import {
  parserFix,
  recordedEvents,
  recordedFinished,
  recordedNow,
} from "./recorded.js";
import { ScreenFrame, viewRecording } from "./screen.js";
import { drawSuspending } from "./terminal.js";

describe.skipIf(!process.env.DOCKET_BENCH)("navigation benchmark", () => {
  for (const mode of ["owed", "activity", "finished"] as const) {
    for (const count of [10, 100, 500]) {
      it(`${mode} with ${count} threads`, { timeout: 120_000 }, async () => {
        const threads = Array.from({ length: count }, (_, index) => ({
          ...parserFix,
          stack: {
            number: Math.floor(index / 3) + 1,
            position: 1,
            size: 3,
            base: "main",
          },
          number: index + 1,
          title: `Issue ${index + 1}`,
          url: `https://github.com/example-org/example-repo/pull/${index + 1}`,
        }));
        const events = threads.map((thread) => ({
          ...recordedEvents[0],
          thread,
          at: recordedNow,
        }));
        const finished = threads.map((thread) => ({
          ...recordedFinished[0],
          number: thread.number,
          title: thread.title,
          url: thread.url,
        }));
        const view = viewRecording({ threads, finished });
        // Hold one clock instant to isolate selection work from the once-per-second tick.
        const now = () => recordedNow;
        if (!("cache" in view.source)) throw new Error("missing cache");
        const status = settleStatus(recordedNow);
        const cache = holdCache(
          { threads, syncedAt: status.syncedAt },
          status,
          events,
          undefined,
          finished,
        );
        const source = {
          ...view.source,
          cache,
          readWatched: async () => ({ watched: view.watched }),
          readEvents: (repo: string, since: Date) =>
            cache.readEvents(repo, since, 300_000),
        };
        const screen = await drawSuspending(
          <ScreenFrame
            {...view}
            now={now}
            mode={mode as TerminalMode}
            source={source}
          />,
          80,
          24,
        );
        await screen.redraw();
        const timings: number[] = [];
        for (let index = 0; index < 32; index++) {
          const direction = index % 2 === 0 ? "down" : "up";
          const started = performance.now();
          const frame = await screen.redraw(() =>
            screen.setup.mockInput.pressArrow(direction),
          );
          const elapsed = performance.now() - started;
          const total = mode === "owed" ? count * 3 : count;
          expect(frame.lines.join(" ")).toContain(
            `${direction === "down" ? 2 : 1}/${total}`,
          );
          if (index >= 2) timings.push(elapsed);
        }
        const groupStarted = performance.now();
        const grouped = await screen.redraw(() =>
          screen.setup.mockInput.pressKey("g"),
        );
        const groupingMs = performance.now() - groupStarted;
        expect(grouped.lines[0]).not.toBe(screen.lines[0]);
        const actionStarted = performance.now();
        const next = await screen.redraw(() =>
          mode === "owed"
            ? screen.setup.mockInput.pressArrow("right")
            : screen.setup.mockInput.pressKey("t"),
        );
        const actionMs = performance.now() - actionStarted;
        expect(next.lines[0]).not.toBe(grouped.lines[0]);
        timings.sort((a, b) => a - b);
        console.log(
          JSON.stringify({
            mode,
            threads: count,
            samples: timings.length,
            medianMs: timings[Math.floor(timings.length / 2)],
            p95Ms: timings[Math.ceil(timings.length * 0.95) - 1],
            groupingMs,
            [mode === "owed" ? "modeSwitchMs" : "windowSwitchMs"]: actionMs,
          }),
        );
      });
    }
  }
});
