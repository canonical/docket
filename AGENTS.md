# AGENTS.md

## Commands

- `bun install`: installs the exact toolchain that `bun.lock` records.
- `bun run ci`: runs every gate below in order, and passes only when all of them pass. A pull request is ready when it passes locally.
- `bun run build`: type-checks the shipped sources with `tsconfig.build.json`, then compiles `src/application/main.ts` into one Linux x64 executable at `dist/docket`.
- `bun run check`: runs Biome's formatter and linter over the repository, then type-checks everything under `src/` with `tsconfig.json`.
- `bunx biome check --write`: applies Biome's formatting and safe lint fixes.
- `bun run test`: runs the unit tests with vitest under Bun.
- `bun run test:coverage`: runs them with v8 coverage, and fails below 100% of the lines, branches, functions and statements in `src/application/` and `src/lib/`.
- `bun run check:identity`: refuses home paths, personal logins outside the attribution fields, real repositories in fixtures, internal tool names, words that describe the project's history, and planning identifiers.
- `bun run check:secrets`: scans every commit and every staged or unstaged change with gitleaks. It uses `gitleaks` from PATH, or runs it through `nix run nixpkgs#gitleaks` when only nix is installed.
- `bun run check:audit`: refuses any dependency with a published advisory (`bun audit`).
- `bun run check:licences`: refuses any production dependency whose licence is not on the permissive list in `src/scripts/check-licences.ts`.
- `bun run check:structure`: checks the source tree's shape against the conventions below: exports and file names, barrels, folders, the direction of imports between domains, and file length.
- `bun run self-test`: proves the identity, secret, advisory, licence and structure gates can each fail, by running each against a scratch fixture it must reject.
- `bun src/application/main.ts [command]` (or `dist/docket` once built): docket's text interface. `owed` (the default), `activity`, `show <reference>`, `assign <reference> <login>…`, `review <reference> <login or org/team>…` and `config`; `--help` after any of them gives its flags, an example and its exit codes.

## Conventions

- TypeScript is strict and resolves modules as `NodeNext`, so a relative import names its file with a `.js` extension.
- `tsconfig.json` extends `@canonical/typescript-config-react` and `biome.json` extends `@canonical/biome-config`. Change a rule locally only with a reason beside it.
- `src/application/` is the composition root and holds the executable's entry. `src/scripts/` holds the repository's gates, each with a `--self-test` mode.
- Each domain sits in its own folder under `src/lib/`, and a file is named for its role inside it: `lib/owed/rows.ts`, never `owedRows.ts`.
- An implementation file under `src/lib/` or `src/application/` exports one value, as its default, and is named after it: `rows.ts` holds `export default function rows`. It may also export the types of its own signature. `types.ts` exports only types and `constants.ts` only named constants.
- A folder's `index.ts` is a barrel: only named re-exports, such as `export { default as rows } from "./rows.js"`, reaching a file beside it or a child folder's `index.js`. It never uses `export *`, and no import uses a `#` path alias.
- No folder is named for a property, such as `utils/`, `helpers/`, `shared/` or `types/`. The exception is `common/` inside a terminal component under `src/lib/ui/`, which holds its subcomponents.
- Imports between domains point one way, and `src/scripts/check-structure.ts` holds the table: the model domains import only each other; the view models import the model, and activity also imports owed, whose field types and owner naming both lists share; the port imports the model's types; the adapter and the cache import the port and the model; the text, token and interface domains import the view models, the tokens and the port's types, and the text and interface domains also the cache's types, to show its status, and the model's types, to show a thread's facts and the settings in effect. Only `src/application/` imports everything. Nothing in `src/lib/` imports `src/application/`, `src/testing/` or `src/scripts/`, and nothing in `src/` imports `guarantees/`.
- Nothing under `src/lib/` reads the system clock. The current time is an argument, so every result is the same under test.
- The model domains derive everything from facts a provider records, such as who wrote a comment and when, and infer none. A rule GitHub does not apply, such as "the author is the assignee", is never applied here.
- The view models (`owed`, `activity`) give each piece of text as a field marked trimmed or wrapped, and never cut it to a width: only a face knows its width, and it measures display cells. They cap no field either: how much room a slot gets, such as the owner on a terminal row, belongs to the face that trims it, and a face that never trims shows every field whole.
- The GitHub provider takes its token only from `gh auth token`, and keeps it inside the provider: it reads no token variable and no file of gh's, and no result or error carries the token. Every request goes through Octokit's throttling and retry plugins, one at a time.
- The cache holds GitHub data only, never the token, in `$XDG_CACHE_HOME/docket` (or `~/.cache/docket`): a file readable by its owner alone, written whole as a temporary file renamed over the old one. One docket process fetches at a time, holding the `fetch.lock` there, and a process that takes the lock reads the cache again before it fetches.
- The cache reaches the data only through the provider interface, never the GitHub adapter. Its tests use `fakeProvider()` from `src/testing/provider.ts`, and prove what happens between processes by starting real ones, such as `src/testing/cacheReader.ts`, on a temporary folder.
- An error a user can meet carries a named code, one sentence and a recovery step. A code names the problem, as `GH_NOT_SIGNED_IN` and `CONFIG_INVALID_DURATION` do, and a domain lists its codes once, in its `types.ts`. Callers and scripts depend on the codes, so a code is never renamed or reused.
- The text interface exits 0 when it answered, cached data served during a GitHub or cache failure included, with the failure as a warning (`show` reads a thread's details from GitHub on every call, so it never answers from cached data alone); 2 for a `GH_*`, `CONFIG_*` or `USAGE_*` code; and 3 for any other code: no data, or a refused or partial write. `src/lib/text/chooseExitCode.ts` holds the rule.
- The help and the reading of the arguments are drawn from the command catalogue, `src/lib/text/catalogue.ts`, and nowhere else: a command, a flag, its choices or its default change there, with the hand-written help.
- Every string from GitHub or from a repository's file goes through `sanitize` before it is printed, and `llm` output marks it as quoted data: each title, login, team, label, check name, file path and branch in double quotes, and comments as `>` lines.
- `assign` and `review` print a plan and change nothing unless given `--confirm`, and never send a change that alters nothing.
- Text mode reads threads, and activity's events, through the cache with `--max-age` (300 seconds by default) and never starts the refresh cycle.
- Each watched repository's `.github/docket.yaml` is read from its default branch through the cache with `--max-age`, as the threads are. An invalid one gives that repository the built-in defaults for the sections it may declare and marks its rows; one GitHub fails to give leaves the personal file's settings, with a warning.
- The terminal interface sits in `src/lib/ui/`, a folder per block under its kind (`subcomponent/`, `component/`): `Name.tsx`, `Name.stories.tsx`, `Name.test.tsx`, `types.ts` and `index.ts`. A block takes its width as a prop and draws within it, trimming or wrapping with `trimText` and `wrapText`, which count display cells with `Bun.stringWidth`, never characters.
- Stories follow Component Story Format, typed by `src/testing/stories.ts`, and the block's tests draw them through OpenTUI's test renderer with `draw()` from `src/testing/terminal.tsx`, asserting the characters and colours of each line at 40 columns and at one wider width.
- Every colour comes from `tokens` in `src/lib/tokens/`, which names meanings, never colours, and each colour on screen is paired with a symbol or a word.
- Keys are bound through OpenTUI's keymap. Each command carries its help label (`desc`), its `group`, an optional key-bar `hint` and `notes`; the help and the key bar read them back with `useCommands`, so a key changes only where it is bound.
- A source file stays within 500 lines, unless its first line reads `// Longer than 500 lines because …` with the reason.
- Every implementation file under `src/lib/` and `src/application/` has its own unit tests beside it, as `<name>.test.ts` (`.test.tsx` for a file holding JSX), with `describe` blocks named for its export; barrels, `types.ts` and `constants.ts` have none. Each `it()` states an outcome a caller can observe.
- Tests mock only at boundaries: the network, the filesystem, timers and `process`.
- Tests of the GitHub provider stub `fetch` with `fakeGitHub()` from `src/testing/github.ts`, which answers with responses in the shapes GitHub gives, and run under fake timers, settling each call with `settle()` so the throttling plugin's waits pass at once. No test reaches the network.
- Tests of the text interface answer from `recordedProvider()` in `src/testing/recorded.ts` at `recordedNow`, and compare whole outputs line by line. `makeHome()` and `openSession()` in `src/testing/docket.ts` run a call, or one command, on a temporary configuration and cache.
- Fixtures and examples use neutral names only: `alice`, `bob`, `example.com`, `example-org/example-repo`.
- Commit subjects follow Conventional Commits, with the domain as the scope. Commits are normal commits: no amending and no force-pushing.
- A pull request fills `.github/PULL_REQUEST_TEMPLATE.md`.

## Boundaries

- `package.json`'s `version` is the only place the version is written. The build reads it into the executable.
- `dist/` is build output and is never committed.
- Security reports go through GitHub's private vulnerability reporting, as `SECURITY.md` says, never through a public issue.

## Gotchas

- The build targets Linux x64 only.
- `src/application/main.ts` runs when it is imported: it is the program's entry, not a library module.
- vitest runs under Bun (`bunx --bun vitest`), the runtime the executable is built on, never under Node.
- vitest compiles JSX with oxc, so JSX options belong under `oxc` in `vitest.config.ts`; it ignores esbuild's.
- A test of the terminal interface presses keys inside `screen.redraw(() => …)`, which lets React's updates settle before the screen is read back.
- OpenTUI's own declaration files fail to type-check, so `tsconfig.json` skips declaration files; every source file is still checked.
- `src/scripts/check-identity.ts` holds the refused words, so it is the one file the identity check skips.
- The audit and its self-test query the advisory database, and the first gitleaks run through nix downloads it, so `bun run ci` needs the network.
- GitHub Actions does not run for this repository, so the local `bun run ci` is the gate: paste its output into the pull request's QA section.
