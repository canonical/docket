import { QueryClient } from "@tanstack/query-core";
import { beforeEach, describe, expect, it } from "vitest";
import { alice, finishedThread, thread } from "../../testing/facts.js";
import type { ThreadEvent } from "../events/index.js";
import createReadQueries from "./createReadQueries.js";

const repo = "example-org/example-repo";
const minute = 60_000;
const fetchedAt = new Date("2026-09-28T10:00:00Z");

const comment = (at: string): ThreadEvent => ({
  kind: "commented",
  thread: thread(),
  actor: alice,
  at: new Date(at),
});

const merged = (at: string) =>
  finishedThread({
    ending: { outcome: "merged", label: "merged", at: new Date(at) },
  });

let clock: Date;
let queries: ReturnType<typeof createReadQueries>;

beforeEach(() => {
  clock = fetchedAt;
  queries = createReadQueries(new QueryClient(), () => clock);
});

describe("createReadQueries", () => {
  it("finds nothing it was never given", () => {
    expect(queries.findEvents(repo)).toBeUndefined();
    expect(queries.findFreshFile(repo, "a.yaml", minute)).toBeUndefined();
    expect(queries.findFreshViewer(minute)).toBeUndefined();
  });

  it("gives the events and the threads that finished from the time asked on, and none from before what it holds", () => {
    const since = new Date("2026-09-20T00:00:00Z");
    queries.keepEvents(
      repo,
      since,
      {
        events: [
          comment("2026-09-21T00:00:00Z"),
          comment("2026-09-27T00:00:00Z"),
        ],
        finished: [
          merged("2026-09-21T00:00:00Z"),
          merged("2026-09-27T00:00:00Z"),
        ],
      },
      fetchedAt,
    );
    expect(queries.findEvents(repo)?.events).toHaveLength(2);
    expect(queries.findEvents(repo)?.finished).toHaveLength(2);
    expect(queries.findEvents(repo, new Date("2026-09-25T00:00:00Z"))).toEqual({
      events: [comment("2026-09-27T00:00:00Z")],
      finished: [merged("2026-09-27T00:00:00Z")],
      syncedAt: fetchedAt,
    });
    expect(
      queries.findEvents(repo, new Date("2026-09-19T00:00:00Z")),
    ).toBeUndefined();
  });

  it("gives each held read only while it is younger than the maximum age", () => {
    const since = new Date("2026-09-20T00:00:00Z");
    queries.keepEvents(repo, since, { events: [], finished: [] }, fetchedAt);
    queries.keepFile(repo, "a.yaml", "text", fetchedAt);
    queries.keepFile(repo, "b.yaml", undefined, fetchedAt);
    queries.keepViewer("alice", fetchedAt);
    clock = new Date(fetchedAt.getTime() + 4 * minute);
    expect(queries.findFreshEvents(repo, since, 5 * minute)).toEqual({
      events: [],
      finished: [],
      syncedAt: fetchedAt,
    });
    expect(queries.findFreshFile(repo, "a.yaml", 5 * minute)).toEqual({
      text: "text",
      syncedAt: fetchedAt,
    });
    expect(queries.findFreshFile(repo, "b.yaml", 5 * minute)).toEqual({
      text: undefined,
      syncedAt: fetchedAt,
    });
    expect(queries.findFreshViewer(5 * minute)).toEqual({
      login: "alice",
      syncedAt: fetchedAt,
    });
    clock = new Date(fetchedAt.getTime() + 5 * minute);
    expect(queries.findFreshEvents(repo, since, 5 * minute)).toBeUndefined();
    expect(queries.findFreshFile(repo, "a.yaml", 5 * minute)).toBeUndefined();
    expect(queries.findFreshViewer(5 * minute)).toBeUndefined();
  });
});
