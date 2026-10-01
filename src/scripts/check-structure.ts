// Longer than 500 lines because each rule and the self-test cases that break it read best in one file.
/**
 * Checks the shape of the source tree.
 *
 * `bun src/scripts/check-structure.ts [root]` reads every source file under
 * `root/src`, and the imports of every file under `root/guarantees`, and
 * exits 1 on a finding. `--self-test` builds a scratch tree
 * that breaks every rule and exits 0 only when the check rejects each break
 * and accepts each allowance.
 *
 * Every rule reads only the files that exist, so a domain with no files yet
 * passes by having nothing to check.
 */
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import ts from "typescript";

type Finding = { file: string; rule: string; message: string };
type Reach = "values" | "types";

const model = ["clock", "config", "people", "waits", "events", "stacks"];
const viewModels = ["owed", "activity"];
const surfaces = ["text", "tokens", "ui"];

/**
 * The one-way direction between domains: for each domain, the other domains
 * it may import, and whether it may import their values or only their types.
 * A domain may always import its own files.
 */
const direction: Record<string, Record<string, Reach>> = {};
function grant(from: string[], to: string[], reach: Reach): void {
  for (const source of from) {
    direction[source] ??= {};
    for (const target of to) {
      const grants = direction[source];
      if (grants && source !== target) grants[target] = reach;
    }
  }
}
grant(model, model, "values");
grant(viewModels, model, "values");
// Both lists name their fields and their owners alike, so activity takes
// owed's field types and owner naming rather than keeping a copy.
grant(["activity"], ["owed"], "values");
grant(["provider"], model, "types");
grant(["github", "cache"], [...model, "provider"], "values");
grant(surfaces, [...viewModels, "tokens"], "values");
grant(surfaces, ["provider"], "types");
// A face shows the cache's status, so it names the status's types; it
// reaches the cache itself only through what the composition root passes.
grant(["text", "ui"], ["cache"], "types");
// A face shows a thread's facts and the settings in effect, so it names the
// model's types, and only its types: it never computes a fact itself.
grant(["text", "ui"], model, "types");
// Both faces draw what GitHub writes, so the interface makes it safe to
// draw with the text domain's rule rather than a copy that could drift.
grant(["ui"], ["text"], "values");

const propertyFolders = new Set([
  "common",
  "helper",
  "helpers",
  "misc",
  "shared",
  "types",
  "util",
  "utils",
]);
/**
 * The fitting module, `src/lib/ui/fit/`, fits every text the terminal
 * draws by one table of rules. Its primitives cut or wrap text without
 * regard to what it is, so nothing outside it imports them.
 */
const fitting = "src/lib/ui/fit/";
const fittingPrimitives =
  /(^|\/)(trimText|wrapText|fitPieces|cutMiddle)(\.js)?$/;

/**
 * Bun's measure of display cells disagrees with what OpenTUI draws, so
 * the terminal measures only through the fitting module's measure, and
 * only that measure's tests name Bun's, to show where the two disagree.
 */
const bunMeasure = /\bBun\.stringWidth\b/;
const bunMeasureTests = /^src\/lib\/ui\/fit\/measureText\.test\./;

const maxLines = 500;
const lengthHeader = /^\/\/ Longer than 500 lines because \S/;

const isTest = (file: string) => /\.(test|stories)\.tsx?$/.test(file);
const isSource = (file: string) => /\.tsx?$/.test(file);

/** Barrels, types and constants hold no behaviour, so they need no test. */
const needsTest = (file: string) =>
  /^src\/(lib|application)\//.test(file) &&
  !isTest(file) &&
  !/^(index|types|constants)\.tsx?$/.test(basename(file));

/** Where a repository path sits: a domain, or one of the other areas. */
function area(path: string): string {
  const domain = /^src\/lib\/([^/]+)\//.exec(path);
  if (domain) return `lib/${domain[1]}`;
  for (const name of ["application", "testing", "scripts"]) {
    if (path.startsWith(`src/${name}/`)) return name;
  }
  return path.startsWith("guarantees/") ? "guarantees" : "outside";
}

type Entry = { path: string; folder: boolean };

function walk(root: string, directory: string): Entry[] {
  const entries = readdirSync(join(root, directory), { withFileTypes: true });
  return entries.flatMap((entry) => {
    const path = `${directory}/${entry.name}`;
    return entry.isDirectory()
      ? [{ path, folder: true }, ...walk(root, path)]
      : [{ path, folder: false }];
  });
}

type Import = { specifier: string; typeOnly: boolean };

/** `import type { A }` and `import { type A, type B }` bring in no value. */
function importsTypesOnly(clause: ts.ImportClause | undefined): boolean {
  if (!clause) return false;
  if (clause.isTypeOnly) return true;
  const bindings = clause.namedBindings;
  return (
    !clause.name &&
    bindings !== undefined &&
    ts.isNamedImports(bindings) &&
    bindings.elements.every((element) => element.isTypeOnly)
  );
}

function importsOf(source: ts.SourceFile): Import[] {
  const found: Import[] = [];
  const visit = (node: ts.Node): void => {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      const typeOnly = ts.isImportDeclaration(node)
        ? importsTypesOnly(node.importClause)
        : node.isTypeOnly;
      found.push({ specifier: node.moduleSpecifier.text, typeOnly });
    }
    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments[0] &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      found.push({ specifier: node.arguments[0].text, typeOnly: false });
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

/** Whether the file calls `import()` with anything but a written path. */
function hasUnreadImport(source: ts.SourceFile): boolean {
  const visit = (node: ts.Node): boolean =>
    (ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      !(node.arguments[0] && ts.isStringLiteral(node.arguments[0]))) ||
    (ts.forEachChild(node, visit) ?? false);
  return visit(source);
}

/** A stories file anywhere under `src/`, as an import names it. */
const isStory = (path: string) => /^src\/.+\.stories\.(js|tsx)$/.test(path);

/** The one corpus file that loads the stories by a path it finds. */
const storyLoader = "guarantees/screens.test.tsx";

const hasModifier = (node: ts.Node, kind: ts.SyntaxKind) =>
  ts.canHaveModifiers(node) &&
  (ts.getModifiers(node) ?? []).some((modifier) => modifier.kind === kind);

type Exports = { defaults: (string | null)[]; values: string[] };

/** The file's default exports by identifier, and its other value exports. */
function exportsOf(source: ts.SourceFile): Exports {
  const found: Exports = { defaults: [], values: [] };
  for (const statement of source.statements) {
    if (ts.isExportAssignment(statement) && !statement.isExportEquals) {
      const expression = statement.expression;
      found.defaults.push(ts.isIdentifier(expression) ? expression.text : null);
    } else if (ts.isExportDeclaration(statement)) {
      if (statement.isTypeOnly) continue;
      const clause = statement.exportClause;
      if (!clause || !ts.isNamedExports(clause)) {
        found.values.push("*");
        continue;
      }
      for (const element of clause.elements) {
        if (element.isTypeOnly) continue;
        if (element.name.text === "default") {
          found.defaults.push((element.propertyName ?? element.name).text);
        } else {
          found.values.push(element.name.text);
        }
      }
    } else if (hasModifier(statement, ts.SyntaxKind.ExportKeyword)) {
      // An overload's signature declares no value: the body that follows
      // it is the one export.
      if (
        ts.isInterfaceDeclaration(statement) ||
        ts.isTypeAliasDeclaration(statement) ||
        (ts.isFunctionDeclaration(statement) && !statement.body)
      ) {
        continue;
      }
      const named = statement as ts.DeclarationStatement;
      const name =
        named.name && ts.isIdentifier(named.name) ? named.name : null;
      if (hasModifier(statement, ts.SyntaxKind.DefaultKeyword)) {
        found.defaults.push(name?.text ?? null);
      } else if (ts.isVariableStatement(statement)) {
        for (const declaration of statement.declarationList.declarations) {
          found.values.push(declaration.name.getText(source));
        }
      } else {
        found.values.push(name?.text ?? "?");
      }
    }
  }
  return found;
}

function checkBarrel(source: ts.SourceFile, report: Report): void {
  for (const statement of source.statements) {
    if (!ts.isExportDeclaration(statement) || !statement.moduleSpecifier) {
      report("barrel", "holds a statement other than a re-export");
      continue;
    }
    const specifier = (statement.moduleSpecifier as ts.StringLiteral).text;
    if (!statement.exportClause) {
      report("barrel", `re-exports everything from "${specifier}"`);
    }
    // A barrel reaches one level: a file beside it, or a child's barrel.
    if (!/^\.\/([^/]+\.js|[^/]+\/index\.js)$/.test(specifier)) {
      report(
        "barrel",
        `re-exports "${specifier}", not ./name.js or ./dir/index.js`,
      );
    }
  }
}

function checkExports(file: string, source: ts.SourceFile, report: Report) {
  const name = basename(file).replace(/\.tsx?$/, "");
  const { defaults, values } = exportsOf(source);
  if (name === "types") {
    if (defaults.length + values.length > 0) {
      report("exports", "a types file exports types only");
    }
    return;
  }
  if (name === "constants") {
    if (defaults.length > 0)
      report("exports", "a constants file has no default");
    return;
  }
  if (defaults.length !== 1) {
    report("exports", `has ${defaults.length} default exports, not one`);
  } else if (defaults[0] !== name) {
    report(
      "file name",
      `default export is ${defaults[0] ?? "anonymous"}, but the file is named ${name}`,
    );
  }
  if (values.length > 0) {
    report(
      "exports",
      `exports values besides the default: ${values.join(", ")}`,
    );
  }
}

function checkImports(file: string, source: ts.SourceFile, report: Report) {
  const from = area(file);
  for (const { specifier, typeOnly } of importsOf(source)) {
    if (specifier.startsWith("#")) {
      report("dependencies", `imports "${specifier}" through a path alias`);
      continue;
    }
    if (!specifier.startsWith(".")) continue;
    const to = area(join(dirname(file), specifier));
    if (to === "guarantees") {
      report("dependencies", `imports the guarantees corpus: ${specifier}`);
    } else if (to === from || from === "testing" || from === "scripts") {
      // An area imports its own files, and the fixtures and the gates read
      // whatever they check.
    } else if (to === "testing" && isTest(file)) {
      // Tests and stories share the fixtures; nothing that ships does.
    } else if (["application", "testing", "scripts"].includes(to)) {
      report("dependencies", `imports ${to}: ${specifier}`);
    } else if (from.startsWith("lib/") && to.startsWith("lib/")) {
      const reach = direction[from.slice(4)]?.[to.slice(4)];
      if (!reach) {
        report("dependencies", `${from} may not import ${to}: ${specifier}`);
      } else if (reach === "types" && !typeOnly) {
        report("dependencies", `${from} may import only types from ${to}`);
      }
    }
  }
}

type Report = (rule: string, message: string) => void;

function check(root: string): Finding[] {
  const findings: Finding[] = [];
  const entries = walk(root, "src");
  const paths = new Set(entries.map((entry) => entry.path));
  for (const { path, folder } of entries) {
    const report: Report = (rule, message) =>
      findings.push({ file: path, rule, message });
    const name = basename(path);
    if (folder) {
      const ui = name === "common" && path.startsWith("src/lib/ui/");
      if (propertyFolders.has(name) && !ui) {
        report("folders", `"${name}" names a property, not a domain`);
      }
      const domain = /^src\/lib\/([^/]+)$/.exec(path)?.[1];
      // A domain the direction table does not name has no direction yet.
      if (domain && !(domain in direction)) {
        report(
          "dependencies",
          `domain "${domain}" is not in the direction table`,
        );
      }
      continue;
    }
    if (!isSource(path)) continue;
    const text = readFileSync(join(root, path), "utf8");
    const source = ts.createSourceFile(
      path,
      text,
      ts.ScriptTarget.Latest,
      true,
    );
    if (
      path.startsWith("src/lib/ui/") &&
      !bunMeasureTests.test(path) &&
      bunMeasure.test(text)
    ) {
      report(
        "fitting",
        "measures with Bun.stringWidth: count cells with measureText from src/lib/ui/fit/",
      );
    }
    if (!path.startsWith(fitting)) {
      for (const { specifier } of importsOf(source)) {
        const target = join(dirname(path), specifier);
        if (
          target.startsWith(fitting) &&
          !fittingPrimitives.test(specifier) &&
          target !== `${fitting}index.js`
        ) {
          report(
            "fitting",
            `imports ${specifier}, past the fitting module's barrel: import from ${fitting}index.js`,
          );
        }
        if (fittingPrimitives.test(specifier)) {
          report(
            "fitting",
            `imports ${specifier}: fit text with fitField, fitRuns, fitBlock, endRuns or markPerson from ${fitting}`,
          );
        }
      }
    }
    const lines = text.split("\n").length - (text.endsWith("\n") ? 1 : 0);
    if (lines > maxLines && !lengthHeader.test(text)) {
      report(
        "length",
        `${lines} lines, over ${maxLines}, with no header saying why`,
      );
    }
    if (!(path.startsWith("src/lib/") || path.startsWith("src/application/"))) {
      checkImports(path, source, report);
      continue;
    }
    if (basename(path) === "index.ts") checkBarrel(source, report);
    else if (!isTest(path)) checkExports(path, source, report);
    checkImports(path, source, report);
    const stem = path.replace(/\.tsx?$/, "");
    if (
      needsTest(path) &&
      !paths.has(`${stem}.test.ts`) &&
      !paths.has(`${stem}.test.tsx`)
    ) {
      report("tests", `has no ${basename(stem)}.test.ts beside it`);
    }
  }
  checkCorpus(root, findings);
  return findings;
}

/**
 * The guarantees corpus reaches docket by running it, as a user does, so
 * a guarantee stays evidence independent of the code it pins. The one
 * exception is the stories files under `src/`, which the `screens` entry
 * draws: a story names a state worth pinning, and only drawing it shows it.
 *
 * In each `.ts` and `.tsx` file under `guarantees/`, the check refuses an
 * `import`, an `export … from` or an `import()` of a written relative path
 * that reaches under `src/` to anything but a `*.stories` file, and an
 * `import()` of a path it cannot read anywhere but in the file that loads
 * the stories. It reads nothing else: `require()`, `import … = require()`,
 * an absolute path, a `file://` URL and a file with another extension go
 * unseen.
 */
function checkCorpus(root: string, findings: Finding[]): void {
  if (!existsSync(join(root, "guarantees"))) return;
  for (const { path, folder } of walk(root, "guarantees")) {
    if (folder || !isSource(path)) continue;
    const text = readFileSync(join(root, path), "utf8");
    const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest);
    for (const { specifier } of importsOf(source)) {
      const target = join(dirname(path), specifier);
      if (target.startsWith("src/") && !isStory(target)) {
        findings.push({
          file: path,
          rule: "dependencies",
          message: `the guarantees corpus imports docket's sources: ${specifier}`,
        });
      }
    }
    if (path !== storyLoader && hasUnreadImport(source)) {
      findings.push({
        file: path,
        rule: "dependencies",
        message: `imports a path the check cannot read; only ${storyLoader} may, to load the stories`,
      });
    }
  }
}

function run(root: string): number {
  const findings = check(root);
  for (const { file, rule, message } of findings) {
    console.error(`${file}: ${rule}: ${message}`);
  }
  if (findings.length > 0) {
    console.error(`structure check: ${findings.length} finding(s)`);
    return 1;
  }
  console.log("structure check: no findings");
  return 0;
}

const long = Array.from({ length: maxLines }, () => "export {};").join("\n");

/** Each file must be rejected, for the rule named beside it. */
const breaks: Record<string, [string, string]> = {
  "src/lib/clock/duration.ts": [
    "file name",
    "export default function span() {}",
  ],
  "src/lib/clock/format.ts": ["exports", "export function format() {}"],
  "src/lib/clock/parse.ts": [
    "exports",
    "export default function parse() {}\nexport const limit = 3;",
  ],
  "src/lib/clock/span.ts": ["file name", "export default () => 1;"],
  "src/lib/clock/index.ts": [
    "barrel",
    'export { default as parse } from "./parse.js";\nexport const x = 1;',
  ],
  "src/lib/people/index.ts": ["barrel", 'export * from "./groups.js";'],
  "src/lib/waits/index.ts": [
    "barrel",
    'export { default as owner } from "./owner";',
  ],
  "src/lib/events/index.ts": [
    "barrel",
    'export { default as range } from "./range/deep/range.js";',
  ],
  "src/lib/owed/utils": ["folders", ""],
  "src/lib/activity/common": ["folders", ""],
  "src/lib/owed/order.ts": [
    "dependencies",
    'import rows from "../activity/index.js";\nexport default function order() { return rows; }',
  ],
  "src/lib/clock/tick.ts": [
    "dependencies",
    'import rows from "../owed/index.js";\nexport default function tick() { return rows; }',
  ],
  "src/lib/text/render.ts": [
    "dependencies",
    'import fetch from "../github/index.js";\nexport default function render() { return fetch; }',
  ],
  "src/lib/text/status.ts": [
    "dependencies",
    'import { createCache } from "../cache/index.js";\nexport default function status() { return createCache; }',
  ],
  "src/lib/text/waits.ts": [
    "dependencies",
    'import { findWaits } from "../waits/index.js";\nexport default function waits() { return findWaits; }',
  ],
  "src/lib/ui/component/Facts/Facts.tsx": [
    "dependencies",
    'import { findWaits } from "../../../waits/index.js";\nexport default function Facts() { return findWaits; }',
  ],
  "src/lib/tokens/palette.ts": [
    "dependencies",
    'import { port } from "../provider/index.js";\nexport default function palette() { return port; }',
  ],
  "src/lib/stacks/relation.ts": [
    "dependencies",
    'import alice from "../../testing/alice.js";\nexport default function relation() { return alice; }',
  ],
  "src/application/wire.ts": [
    "dependencies",
    'import pins from "../../guarantees/pins.js";\nexport default function wire() { return pins; }',
  ],
  "src/testing/pins.ts": [
    "dependencies",
    'import pins from "../../guarantees/pins.js";\nexport const all = pins;',
  ],
  "guarantees/pins.ts": [
    "dependencies",
    'import { rows } from "../src/lib/owed/index.js";\nexport default rows;',
  ],
  "guarantees/row.ts": [
    "dependencies",
    'import ThreadRow from "../src/lib/ui/component/ThreadRow/ThreadRow.js";\nexport default ThreadRow;',
  ],
  "guarantees/frame.ts": [
    "dependencies",
    'import Screen from "../src/application/Screen.js";\nexport default Screen;',
  ],
  "guarantees/fixture.ts": [
    "dependencies",
    'import { recordedNow } from "../src/testing/recorded.js";\nexport default recordedNow;',
  ],
  "guarantees/load.ts": [
    "dependencies",
    "const path = process.argv[2];\nexport default await import(path);",
  ],
  "src/lib/config/load.ts": [
    "dependencies",
    'import clock from "#clock";\nexport default function load() { return clock; }',
  ],
  "src/lib/billing": ["dependencies", ""],
  "src/lib/config/schema.ts": ["length", `${long}\nexport default 1;`],
  "src/lib/config/types.ts": ["exports", "export const x = 1;"],
  "src/lib/waits/owner.ts": ["tests", "export default function owner() {}"],
  "src/lib/ui/component/Row/Row.tsx": [
    "fitting",
    'import trimText from "../../fit/trimText.js";\nexport default function Row() { return trimText; }',
  ],
  "src/application/wrap.ts": [
    "fitting",
    'export { default as wrapText } from "../lib/ui/fit/wrapText.js";',
  ],
  "src/lib/ui/component/Runs/Runs.tsx": [
    "fitting",
    'import fitPieces from "../../fit/fitPieces.js";\nexport default function Runs() { return fitPieces; }',
  ],
  "src/lib/ui/component/Table/Table.tsx": [
    "fitting",
    'import { fitRules } from "../../fit/constants.js";\nexport default function Table() { return fitRules; }',
  ],
  "src/lib/ui/component/Gap/Gap.tsx": [
    "fitting",
    "export default function Gap(text: string) { return Bun.stringWidth(text); }",
  ],
  "src/lib/ui/fit/cutMiddle.ts": [
    "fitting",
    "export default function cutMiddle(text: string) { return Bun.stringWidth(text); }",
  ],
  "src/lib/ui/fit/measureCluster.ts": [
    "fitting",
    "export default function measureCluster(text: string) { return Bun.stringWidth(text); }",
  ],
  "src/lib/ui/fit/measureText.ts": [
    "fitting",
    "export default function measureText(text: string) { return Bun.stringWidth(text); }",
  ],
  "src/lib/ui/component/Name/Name.tsx": [
    "fitting",
    'import cutMiddle from "../../fit/cutMiddle.js";\nexport default function Name() { return cutMiddle; }',
  ],
  "src/lib/ui/component/Cut/Cut.tsx": [
    "fitting",
    'import cutMiddle from "../../fit/cutMiddle";\nexport default function Cut() { return cutMiddle; }',
  ],
};

/** Each file must be accepted: the allowances and the rules' scopes. */
const allowed: Record<string, string> = {
  "src/lib/ui/component/ThreadRow/common/Margin/Margin.tsx":
    "export default function Margin() { return null; }",
  "src/lib/ui/component/ThreadRow/ThreadRow.tsx": [
    'import type { Port } from "../../../provider/index.js";',
    'import type { CacheStatus } from "../../../cache/index.js";',
    'import type { Thread } from "../../../waits/index.js";',
    'import rows from "../../../owed/index.js";',
    "export default function ThreadRow(port: Port, status: CacheStatus, thread: Thread) { return [port, status, thread, rows]; }",
  ].join("\n"),
  "src/lib/text/facts.ts": [
    'import type { Thread } from "../waits/index.js";',
    "export default function facts(thread: Thread) { return thread; }",
  ].join("\n"),
  "src/lib/ui/component/ThreadRow/index.ts":
    'export { default as ThreadRow } from "./ThreadRow.js";',
  "src/lib/owed/rows.ts": [
    'import clock from "../clock/index.js";',
    "export type Row = { at: number };",
    "export default function rows(): Row[] { return [{ at: clock }]; }",
  ].join("\n"),
  "src/lib/activity/rows.ts": [
    'import { describeOwners } from "../owed/index.js";',
    "export default function rows() { return describeOwners; }",
  ].join("\n"),
  "src/lib/owed/rows.test.ts":
    'import alice from "../../testing/alice.js";\nalice;',
  "src/lib/owed/types.ts":
    "export type Group = string;\nexport interface Kind {}",
  "src/lib/owed/constants.ts": "export const limit = 3;",
  "src/lib/owed/fitRow.ts": [
    "export default function fitRow(row: string): string;",
    "export default function fitRow(row: number): number;",
    "export default function fitRow(row: string | number) { return row; }",
  ].join("\n"),
  "src/lib/owed/index.ts": [
    'export { default as rows } from "./rows.js";',
    'export type { Group } from "./types.js";',
    'export { default as ThreadRow } from "./order/index.js";',
  ].join("\n"),
  "src/lib/github/snapshot.ts": [
    'import type { Port } from "../provider/index.js";',
    'import provider from "../provider/index.js";',
    'import clock from "../clock/index.js";',
    "export default function snapshot(): Port { return [provider, clock]; }",
  ].join("\n"),
  "src/lib/ui/component/Fitted/Fitted.tsx":
    'import { fitField } from "../../fit/index.js";\nexport default function Fitted() { return fitField; }',
  "src/lib/ui/fit/measureText.test.tsx":
    'import { expect, it } from "vitest";\nit("differs", () => { expect(Bun.stringWidth("❤")).toBe(1); });',
  "src/lib/ui/fit/fitField.ts": [
    'import trimText from "./trimText.js";',
    'import fitPieces from "./fitPieces.js";',
    "export default function fitField() { return [trimText, fitPieces]; }",
  ].join("\n"),
  "src/lib/config/long.ts": `// Longer than 500 lines because the schema is one table\n${long}\nexport default function long() {}`,
  "src/application/main.ts": [
    'import manifest from "../../package.json" with { type: "json" };',
    'import snapshot from "../lib/github/index.js";',
    "export default function main() { return [manifest, snapshot]; }",
  ].join("\n"),
  "src/lib/ui/component/ThreadRow/ThreadRow.test.tsx": "",
  "src/testing/alice.ts": 'export const alice = "alice";',
  "guarantees/entry.test.ts":
    'import makeHome from "./makeHome.js";\nmakeHome;',
  "guarantees/screen.test.ts":
    'import * as stories from "../src/lib/ui/component/ThreadRow/ThreadRow.stories.js";\nstories;',
  "guarantees/frames.test.ts":
    'import * as stories from "../src/application/Screen.stories.js";\nstories;',
  "guarantees/screens.test.tsx":
    "const path = process.argv[2];\nexport default await import(path);",
  "src/scripts/check.ts": 'import x from "../lib/owed/index.js";\nx;',
};

function selfTest(): number {
  const root = mkdtempSync(join(tmpdir(), "structure-fixture-"));
  try {
    const files = { ...allowed };
    // Every other allowed file gets the test beside it that the rule asks for.
    for (const path of Object.keys(allowed)) {
      const stem = path.replace(/\.tsx?$/, "");
      if (needsTest(path) && !(`${stem}.test.tsx` in allowed)) {
        files[`${stem}.test.ts`] ??= "";
      }
    }
    for (const [path, [, text]] of Object.entries(breaks)) files[path] = text;
    for (const [path, text] of Object.entries(files)) {
      if (isSource(path)) {
        mkdirSync(join(root, dirname(path)), { recursive: true });
        writeFileSync(join(root, path), `${text}\n`);
      } else {
        mkdirSync(join(root, path), { recursive: true });
      }
    }
    const findings = check(resolve(root));
    const failures: string[] = [];
    for (const [path, [rule]] of Object.entries(breaks)) {
      if (!findings.some((f) => f.file === path && f.rule === rule)) {
        failures.push(`${path} was not rejected for "${rule}"`);
      }
    }
    for (const path of Object.keys(allowed)) {
      for (const f of findings.filter((finding) => finding.file === path)) {
        failures.push(`${path} was rejected but is allowed: ${f.message}`);
      }
    }
    if (failures.length > 0) {
      for (const failure of failures) console.error(failure);
      return 1;
    }
    console.log(
      `structure self-test: ${Object.keys(breaks).length} breaks rejected, ${Object.keys(allowed).length} allowances accepted`,
    );
    return 0;
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

const [argument] = process.argv.slice(2);
process.exitCode =
  argument === "--self-test" ? selfTest() : run(argument ?? process.cwd());
