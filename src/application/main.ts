import manifest from "../../package.json" with { type: "json" };

/** Writes docket's version, taken from the manifest at build time. */
export default function main(): void {
  process.stdout.write(`${manifest.version}\n`);
}

// The executable runs this module as its entry, so the call is the program.
main();
