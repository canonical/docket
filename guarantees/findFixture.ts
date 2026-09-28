import { resolve } from "node:path";

/** The file under `fixtures/` a guarantee reads. */
export default function findFixture(name: string): string {
  return resolve(import.meta.dirname, "fixtures", name);
}
