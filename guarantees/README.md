# guarantees

The few behaviours of docket whose silent change would mislead a maintainer or an agent, pinned from outside. Each guarantee is a test file and a row in `corpus.toml`: the file asserts one fact about docket as a user runs it, and the row says what kind of fact it is, when it runs, and whether it is built to pass or to fail.

## A layer of its own

The unit tests beside the code pin behaviour from inside. The corpus pins it from outside: it starts docket as its own process and reads only what a user reads. Nothing here imports `src/`, and nothing in `src/` imports this folder. A guarantee is written as one from the start, and a unit test never moves here.

## Commands

| Command | What it does |
|---|---|
| `bun run guarantees` | Runs every entry of the `pr` tier, one at a time. Exit 0 means the tier is green. |
| `bun guarantees/invoker.ts run <entry>` | Runs one entry. |
| `bun guarantees/invoker.ts list` | Lists the register. |

## Why a green tier can be believed

The invoker judges each run by vitest's own report, not by its exit code alone: a run that executed no test fails, whether its selector matched nothing or its file never loaded. Each tier holds one entry built to fail, `selftest/corpus-can-fail`, and the tier is green only when that entry failed as a test and every other entry passed. The register is refused whole when a test file here belongs to no row, because a file no row names never runs.

## The entries

| Entry | Kind | What it pins |
|---|---|---|
| `corpus-can-fail` | conformance | Fails on purpose, so a green tier means something. |
