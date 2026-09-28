/**
 * Breaks the corpus on purpose, one entry at a time, and requires each
 * entry to notice. A detector in the corpus can go blind without anything
 * in docket changing, and an entry whose detector is blind passes.
 *
 * - `text-output`: one saved output is moved aside, and the entry must
 *   fail for the missing copy. A golden entry that passed without its
 *   saved output would be recording on absence, and whatever docket
 *   printed next would pass as the saved output.
 * - `request-budget`: the stand-in holds another request open beside
 *   each one docket sends, and the entry must see two open at once.
 * - `working-clock`: the stand-in answers every recorded instant an hour
 *   later, and the entry must see the replies fall due at other times;
 *   then the stand-in's clock reads an hour later, and the entry must see
 *   less time left, which shows it reads the clock it is given.
 *
 * - `hostile-text`: docket's JSON writes each string as it was given,
 *   and the entry must find the control characters a program reads back.
 *   It also checks its own pattern against every hostile word, on every
 *   run.
 *
 * The invoker's verdict is read from its own report line, not from how
 * it exited: a register that does not parse exits non-zero too, without
 * the entry ever running. Whatever a proof moves is put back on every
 * path.
 *
 * @note Impure: moves a file in `goldens/` and back, and starts the
 * invoker.
 */
import { renameSync } from "node:fs";
import { join } from "node:path";

const corpusRoot = import.meta.dirname;
const golden = join(corpusRoot, "goldens/text-output/owed.plain.txt");

interface Proof {
  readonly entry: string;
  /** The stand-in's break, as `GUARANTEES_BREAK` names it. */
  readonly standInBreak?: string;
  /** Breaks the corpus before the run, and returns what mends it. */
  readonly prepare?: () => () => void;
  /** What the entry's output must say for the failure to be this one. */
  readonly failure: string;
}

const proofs: readonly Proof[] = [
  {
    entry: "text-output",
    prepare: () => {
      renameSync(golden, `${golden}.aside`);
      return () => renameSync(`${golden}.aside`, golden);
    },
    failure: "no saved output at goldens/text-output/owed.plain.txt",
  },
  {
    entry: "request-budget",
    standInBreak: "overlap",
    failure: "× never has two requests open at once",
  },
  {
    entry: "working-clock",
    standInBreak: "shift",
    failure:
      "× carries a reply asked on Friday at 16:00 over the weekend to Monday at 16:00",
  },
  {
    entry: "working-clock",
    standInBreak: "later",
    failure:
      "× leaves 15 hours at 01:00 on Monday in the configured time zone, while it is still Sunday in UTC",
  },
  {
    entry: "hostile-text",
    standInBreak: "unsanitized",
    failure:
      "× gives a pull request's base branch without its sequences in json",
  },
];

/** How the report names `proof`: its entry, and its break when it has one. */
const nameProof = ({ entry, standInBreak }: Proof) =>
  standInBreak ? `${entry} (${standInBreak})` : entry;

/** Runs `proof`'s entry broken, and says whether it failed as it must. */
const checkProof = async (proof: Proof): Promise<boolean> => {
  const mend = proof.prepare?.();
  try {
    const child = Bun.spawn(
      [process.execPath, join(corpusRoot, "invoker.ts"), "run", proof.entry],
      {
        stdout: "pipe",
        stderr: "pipe",
        env: proof.standInBreak
          ? { ...process.env, GUARANTEES_BREAK: proof.standInBreak }
          : process.env,
      },
    );
    const [out, err] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited,
    ]);
    process.stderr.write(out + err);
    const reported = new RegExp(
      `^\\s*BAD\\s+${proof.entry}\\s+\\d+ passed, (\\d+) failed`,
      "m",
    ).exec(err);
    return (
      Number(reported?.at(1) ?? 0) > 0 && `${out}${err}`.includes(proof.failure)
    );
  } finally {
    mend?.();
  }
};

const unproved: string[] = [];
for (const proof of proofs) {
  if (!(await checkProof(proof))) unproved.push(nameProof(proof));
}

if (unproved.length > 0) {
  console.error(
    `\nprove: FAILED. ${unproved.join(", ")} did not fail when broken: either it passed, or it failed for another reason, or it never ran, and the output above says which.`,
  );
  process.exit(1);
}
console.error(
  `\nprove: ${proofs.map(nameProof).join(", ")} each failed when broken, as they must.`,
);
