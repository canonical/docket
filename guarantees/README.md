# guarantees

The few behaviours of docket whose silent change would mislead a maintainer or an agent, pinned from outside. Each guarantee is a test file and a row in `corpus.toml`: the file asserts one fact about docket as a user runs it, and the row says what kind of fact it is, when it runs, and whether it is built to pass or to fail.

## A layer of its own

The unit tests beside the code pin behaviour from inside. The corpus pins it from outside: it starts docket as its own process, `bun src/application/main.ts`, and reads only what a user reads, the output, the exit code and the requests docket sent to GitHub. Nothing here imports `src/` but its stories files (`*.stories.tsx`), and nothing in `src/` imports this folder. `bun run check:structure` holds both: in each `.ts` and `.tsx` file here it refuses an `import`, an `export … from` or an `import()` of a written relative path under `src/` to anything but a stories file, and an `import()` of a path it cannot read anywhere but in `screens.test.tsx`, the file that loads the stories. It does not see `require()`, `import … = require()`, an absolute path, a `file://` URL or a file with another extension. `screens` draws those stories in its own process, through OpenTUI's test renderer, since a story names a state worth pinning and only drawing it shows it. A guarantee is written as one from the start, and a unit test never moves here.

## What a call runs against

`makeHome.ts` runs each call in a temporary home: a personal file, an empty cache folder, and a `gh` on `PATH` that answers with a token no account holds. Nothing of the machine's own environment reaches docket.

`standIn.ts` is preloaded into that process (`bun --preload`) and stands in for the two things outside docket that a guarantee has to fix, without any change to docket's code:

- the clock: `new Date()` gives the instant the guarantee names;
- GitHub: `fetch` answers from a recording under `fixtures/`, logs every request, and answers a request that sends back an entity tag with "not modified", as GitHub does;
- the machine: the time zone its process runs in is written first in the request log, so an entry can check that the zone it asked for reached docket.

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

A detector in the corpus can go blind without anything in docket changing, and an entry whose detector is blind passes. `bun run guarantees:prove` breaks each detector on purpose and succeeds only when its entry failed for that break: it moves one saved output aside and requires `text-output` to fail for the missing copy; it has the stand-in hold another request open beside each one docket sends (`GUARANTEES_BREAK=overlap`) and requires `request-budget` to see two open at once; it has the stand-in answer every recorded instant an hour later (`GUARANTEES_BREAK=shift`) and requires `working-clock` to see the replies fall due at other times; and it has the stand-in's clock read an hour later (`GUARANTEES_BREAK=later`) and requires `working-clock` to see less time left, so the entry is seen to read the clock it is given; it has `JSON.stringify` write every string as it was given (`GUARANTEES_BREAK=unsanitized`) and requires `hostile-text` to find control characters in the strings a program reads back from `json` output; then it has `JSON.stringify` write a string given on its own without its quotes (`GUARANTEES_BREAK=unquoted`) and requires `hostile-text` to find a branch printed bare in `llm` output. For `screens`, it moves one saved screen aside and requires the entry to fail for the missing copy, then has the entry write each run of text without its colours (`GUARANTEES_BREAK=uncoloured`) and requires it to find the screens differ from their saved copies, so the copies are seen to pin the colours. `hostile-text` also checks its own pattern against every hostile word on every run.

## The entries

| Entry | Kind | What it pins |
|---|---|---|
| `working-clock` | determinism | A 24-hour reply target set on Friday at 16:00 falls due on Monday at 16:00, across weekends, time zones and the change to and from daylight saving time. What is left before a reply is due, or how far past it is, counts working time only, in the configured time zone: on a weekend, across midnight there while UTC is still on the day before, and after the clocks go back. The machine's own time zone changes none of it. |
| `text-output` | golden | What `owed` and `activity` print in `plain`, `llm` and `json`, from a fixed recording at a fixed instant. |
| `hostile-text` | conformance | Control sequences in a title, a comment, a label, a check name and a branch name are never printed, and no string a program reads back from `json` output holds one, a pull request's base branch included; in `llm` output titles, labels, check names and branches are in double quotes and comments are `>` lines. |
| `request-budget` | budget | A refresh every 120 seconds stays within the points and requests proposed for GitHub's limits, and docket never has two requests open at once. |
| `screens` | golden | Every story under `src/`, the blocks' and the composed screen's, drawn as a person sees it at 40 and 60 columns: the characters of each line, and the colours and attributes of each run of text. Below 40 columns the pane says only `docket needs 40 columns`. |
| `corpus-can-fail` | conformance | Fails on purpose, so a green tier means something. |
