import { describe, expect, it } from "vitest";
import {
  closedBump,
  completed,
  finishedList,
  notPlanned,
} from "../../testing/finished.js";
import type { FinishedThread } from "../endings/index.js";
import describeFinishedData from "./describeFinishedData.js";

/** Every control character but the line feed. */
// biome-ignore lint/suspicious/noControlCharactersInRegex: these are the characters looked for.
const control = /[\u0000-\u0009\u000b-\u001f\u007f-\u009f]/;

/** The one row finished gives for `thread`, as data. */
const dataOf = (thread: FinishedThread) => {
  const [row] = finishedList("none", [thread]).groups[0]?.rows ?? [];
  if (!row) throw new Error("the list holds the thread");
  return describeFinishedData(row);
};

describe("describeFinishedData", () => {
  it("gives a thread's ending as an outcome beside the provider's words, who ended it, and its measures", () => {
    expect(dataOf(notPlanned)).toEqual({
      reference: "example#7",
      title: "Dark mode everywhere",
      kind: "issue",
      owners: [],
      draft: false,
      stack: null,
      invalidRepositoryFile: false,
      ending: { outcome: "notPlanned", label: "closed as not planned" },
      endedAt: "2026-09-23T08:00:00.000Z",
      endedBy: { login: "alice", group: "you" },
      openedAt: "2026-08-03T08:00:00.000Z",
      exempt: false,
      verdict: "over",
      measures: {
        close: {
          state: "measured",
          target: "720h",
          overdue: 168 / 720,
          verdict: "over",
        },
        firstResponse: { state: "unsupported" },
        firstReview: { state: "unsupported" },
      },
    });
  });

  it("gives what closed a thread and what it duplicates where GitHub records them, and nobody when it records no one", () => {
    const duplicate = dataOf({
      ...completed,
      ending: {
        outcome: "duplicate",
        label: "closed as duplicate",
        at: completed.ending.at,
        closer: {
          kind: "commit",
          oid: "c0ffee1",
          url: "https://github.com/example-org/example-docs/commit/c0ffee1",
        },
        duplicateOf: {
          repo: "example-org/example-docs",
          number: 3,
          url: "https://github.com/example-org/example-docs/issues/3",
        },
      },
    });
    expect(duplicate).toMatchObject({
      endedBy: null,
      closer: {
        kind: "commit",
        oid: "c0ffee1",
        url: "https://github.com/example-org/example-docs/commit/c0ffee1",
      },
      duplicateOf: {
        repo: "example-org/example-docs",
        number: 3,
        url: "https://github.com/example-org/example-docs/issues/3",
      },
    });
    expect(dataOf(completed).closer).toEqual({
      kind: "pullRequest",
      repo: "example-org/example-repo",
      number: 2,
      url: "https://github.com/example-org/example-repo/pull/2",
    });
    expect(dataOf(notPlanned)).not.toHaveProperty("closer");
    expect(dataOf(notPlanned)).not.toHaveProperty("duplicateOf");
  });

  it("marks a thread a label exempts, with no verdict, and names a project that closed it by its kind alone", () => {
    const exempt = dataOf({
      ...closedBump,
      ending: { ...closedBump.ending, closer: { kind: "project" } },
    });
    expect(exempt).toMatchObject({
      exempt: true,
      draft: true,
      closer: { kind: "project" },
      measures: { close: { state: "notApplicable" } },
    });
    expect(exempt).not.toHaveProperty("verdict");
  });

  it("gives every string written on GitHub free of control characters", () => {
    const data = dataOf({
      ...completed,
      title: "Where do tokens live?\u001b[2J",
      ending: {
        ...completed.ending,
        by: { login: "bob\u009b1;1H", type: "user" },
        closer: {
          kind: "pullRequest",
          repo: "example-org/example-repo\u0007",
          number: 2,
          url: "https://github.com/example-org/example-repo/pull/2\u001b]0;x\u0007",
        },
        duplicateOf: {
          repo: "example-org/example-docs\u0007",
          number: 3,
          url: "https://github.com/example-org/example-docs/issues/3\u009b2J",
        },
      },
    });
    const strings: string[] = [];
    JSON.stringify(data, (_key, value) => {
      if (typeof value === "string") strings.push(value);
      return value;
    });
    expect(strings.filter((text) => control.test(text))).toEqual([]);
    expect(data).toMatchObject({
      title: "Where do tokens live?",
      endedBy: { login: "bob" },
      closer: { url: "https://github.com/example-org/example-repo/pull/2" },
      duplicateOf: {
        url: "https://github.com/example-org/example-docs/issues/3",
      },
    });
  });
});
