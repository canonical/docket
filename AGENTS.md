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
- `bun run self-test`: proves the identity, secret, advisory and licence gates can each fail, by running each against a scratch fixture it must reject.

## Conventions

- TypeScript is strict and resolves modules as `NodeNext`, so a relative import names its file with a `.js` extension.
- `tsconfig.json` extends `@canonical/typescript-config-react` and `biome.json` extends `@canonical/biome-config`. Change a rule locally only with a reason beside it.
- `src/application/` is the composition root and holds the executable's entry. `src/scripts/` holds the repository's gates, each with a `--self-test` mode.
- Unit tests sit beside the code they test, as `<name>.test.ts`. Each `it()` states an outcome a caller can observe.
- Tests mock only at boundaries: the network, the filesystem, timers and `process`.
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
- `src/scripts/check-identity.ts` holds the refused words, so it is the one file the identity check skips.
- The audit and its self-test query the advisory database, and the first gitleaks run through nix downloads it, so `bun run ci` needs the network.
- GitHub Actions does not run for this repository, so the local `bun run ci` is the gate: paste its output into the pull request's QA section.
