import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parseFile, resolveSettings } from "../lib/config/index.js";
import { type Home, makeHome, openSession } from "../testing/docket.js";
import { carol, thread } from "../testing/facts.js";
import { parserFix, recordedProvider } from "../testing/recorded.js";
import answerShow from "./answerShow.js";

let home: Home;

beforeEach(async () => {
  home = await makeHome();
});

afterEach(async () => {
  await home.remove();
});

describe("answerShow", () => {
  it("shows a thread with the details GitHub gives and its waits", async () => {
    const { session, out } = openSession(home, ["show", "example#12"]);
    expect(await answerShow(session)).toBe(0);
    expect(out()).toMatch(/^# show example#12\n/);
    expect(out()).toContain('## example#12\n- title "Fix the parser"\n');
    expect(out()).toContain(
      '### waits\n- example#12 · "Fix the parser" · reply',
    );
    expect(out()).toContain("> Could someone look again?");
  });

  it("shows a stack's open pull requests bottom first", async () => {
    const top = {
      ...parserFix,
      number: 13,
      stack: { ...parserFix.stack, position: 3 },
    } as typeof parserFix;
    const provider = recordedProvider({
      snapshot: async (repo) => ({
        threads: repo === parserFix.repo ? [top, parserFix] : [],
        cursor: null,
      }),
    });
    const { session, out } = openSession(
      home,
      ["show", "example", "stack", "3"],
      provider,
    );
    await answerShow(session);
    expect(out()).toMatch(/^# show example stack 3\n/);
    expect(out().indexOf("## example#12")).toBeGreaterThan(0);
    expect(out().indexOf("## example#12")).toBeLessThan(
      out().indexOf("## example#13"),
    );
  });

  it("measures the thread's waits on its repository's own settings", async () => {
    const { session, out } = openSession(home, ["show", "docs#4"]);
    const personal = session.personal.outcome?.ok
      ? session.personal.outcome.layer
      : undefined;
    const resolved = resolveSettings(
      personal,
      parseFile(
        "version: 1\ntargets:\n  close:\n    issue: 40d\n",
        "repository",
      ),
    );
    const watched = session.watched.map((repo) =>
      repo.name === "docs" ? { ...repo, resolved } : repo,
    );
    await answerShow({ ...session, watched });
    // Opened 1 September, the issue is due 40 working days later.
    expect(out()).toContain(
      '· close · author "alice" (you) · owners "alice", "bob" · 20d left · due 2026-10-27 10:00 Europe/Paris\n',
    );
  });

  it("gives an author the group their writing elsewhere in the repository shows", async () => {
    const unmarked = thread({ number: 7, author: { ...carol, member: false } });
    const provider = recordedProvider({
      snapshot: async (repo) => ({
        threads:
          repo === unmarked.repo ? [thread({ author: carol }), unmarked] : [],
        cursor: null,
      }),
    });
    const { session, out } = openSession(
      home,
      ["show", "example#7", "--format", "json"],
      provider,
    );
    await answerShow(session);
    const [{ waits }] = JSON.parse(out()).threads;
    const authors = waits.map(({ author }: { author: object }) => author);
    expect(authors).toEqual([
      { login: "carol", group: "internal" },
      { login: "carol", group: "internal" },
    ]);
  });

  it("refuses more than one reference", async () => {
    const { session } = openSession(home, ["show", "example#12", "docs#4"]);
    await expect(answerShow(session)).rejects.toMatchObject({
      code: "USAGE_UNEXPECTED_ARGUMENT",
      message:
        "docket show takes one reference, and was given `example#12 docs#4`.",
    });
  });

  it("fails with THREAD_NOT_FOUND when no open thread answers", async () => {
    const { session } = openSession(home, ["show", "docs#99"]);
    await expect(answerShow(session)).rejects.toMatchObject({
      code: "THREAD_NOT_FOUND",
    });
  });
});
