# AGENTS.md

## Commands

- `bun install`: installs the exact toolchain that `bun.lock` records.
- `bun run build`: type-checks the shipped sources with `tsconfig.build.json`, then compiles `src/application/main.ts` into one Linux x64 executable at `dist/docket`.
- `bun run check`: runs Biome's formatter and linter over the repository, then type-checks everything under `src/` with `tsconfig.json`.
- `bunx biome check --write`: applies Biome's formatting and safe lint fixes.

## Conventions

- TypeScript is strict and resolves modules as `NodeNext`, so a relative import names its file with a `.js` extension.
- `tsconfig.json` extends `@canonical/typescript-config-react` and `biome.json` extends `@canonical/biome-config`. Change a rule locally only with a reason beside it.
- `src/application/` is the composition root and holds the executable's entry.
- Commit subjects follow Conventional Commits, with the domain as the scope. Commits are normal commits: no amending and no force-pushing.

## Boundaries

- `package.json`'s `version` is the only place the version is written. The build reads it into the executable.
- `dist/` is build output and is never committed.

## Gotchas

- The build targets Linux x64 only.
- `src/application/main.ts` runs when it is imported: it is the program's entry, not a library module.
