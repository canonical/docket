# guarantees

The few behaviours of docket whose silent change would mislead a maintainer or an agent, pinned from outside. Each guarantee is a test file and a row in `corpus.toml`: the file asserts one fact about docket as a user runs it, and the row says what kind of fact it is, when it runs, and whether it is built to pass or to fail.

## A layer of its own

The unit tests beside the code pin behaviour from inside. The corpus pins it from outside: it starts docket as its own process, `bun src/application/main.ts`, and reads only what a user reads, the output, the exit code and the requests docket sent to GitHub. Nothing here imports `src/`, and nothing in `src/` imports this folder; `bun run check:structure` refuses both. A guarantee is written as one from the start, and a unit test never moves here.

## What a call runs against

`makeHome.ts` runs each call in a temporary home: a personal file, an empty cache folder, and a `gh` on `PATH` that answers with a token no account holds. Nothing of the machine's own environment reaches docket.

`standIn.ts` is preloaded into that process (`bun --preload`) and stands in for the two things outside docket that a guarantee has to fix, without any change to docket's code:

- the clock: `new Date()` gives the instant the guarantee names;
- GitHub: `fetch` answers from a recording under `fixtures/`, logs every request, and answers a request that sends back an entity tag with "not modified", as GitHub does.

The recordings are written in GitHub's own response shapes, from GitHub's API, with neutral names only.

## Commands

| Command | What it does |
|---|---|
| `bun run guarantees` | Runs every entry of the `pr` tier, one at a time. Exit 0 means the tier is green. |
| `bun guarantees/invoker.ts run <entry>` | Runs one entry. |
| `bun guarantees/invoker.ts list` | Lists the register. |
| `bun run guarantees:accept <entry>` | Runs one entry and saves what it prints as its saved outputs under `goldens/`, for review as a diff. |
| `bun run guarantees:prove` | Breaks the corpus on purpose and requires it to notice. |

## Why a green tier can be believed

The invoker judges each run by vitest's own report, not by its exit code alone: a run that executed no test fails, whether its selector matched nothing or its file never loaded. Each tier holds one entry built to fail, `selftest/corpus-can-fail`, and the tier is green only when that entry failed as a test and every other entry passed. The register is refused whole when a test file here belongs to no row, because a file no row names never runs.

A saved output that is missing fails its entry; saving one is the explicit act `guarantees:accept`.

A detector in the corpus can go blind without anything in docket changing, and an entry whose detector is blind passes. `bun run guarantees:prove` breaks each detector on purpose and succeeds only when its entry failed for that break: it moves one saved output aside and requires `text-output` to fail for the missing copy; it has the stand-in hold another request open beside each one docket sends (`GUARANTEES_BREAK=overlap`) and requires `request-budget` to see two open at once; and it has the stand-in answer every recorded instant an hour later (`GUARANTEES_BREAK=shift`) and requires `working-clock` to see the replies fall due at other times. `hostile-text` checks its own pattern against every hostile word on every run.

## The entries

| Entry | Kind | What it pins |
|---|---|---|
| `working-clock` | determinism | A 24-hour reply target set on Friday at 16:00 falls due on Monday at 16:00, across weekends, time zones and the change to and from daylight saving time; the machine's own time zone changes nothing. |
| `text-output` | golden | What `owed` and `activity` print in `plain`, `llm` and `json`, from a fixed recording at a fixed instant. |
| `hostile-text` | conformance | Control sequences in a title, a comment, a label, a check name and a branch name are never printed; in `llm` output titles are in double quotes and comments are `>` lines. |
| `request-budget` | budget | A refresh every 120 seconds stays within the points and requests proposed for GitHub's limits, and docket never has two requests open at once. |
| `corpus-can-fail` | conformance | Fails on purpose, so a green tier means something. |
