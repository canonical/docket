import { builtInSettings, sectionsByPlace } from "./constants.js";
import type {
  ConfigError,
  FileOutcome,
  Layer,
  Origin,
  Section,
  Settings,
} from "./types.js";

/** One repository's settings, and where each section came from. */
export interface Resolved {
  readonly settings: Settings;
  readonly origins: Readonly<Record<Section, Origin>>;
  /**
   * The errors of the repository's own file. When there are any, the
   * repository uses the built-in defaults for the sections that file may
   * declare, and its rows are marked as using an invalid configuration.
   */
  readonly repositoryErrors: readonly ConfigError[];
}

/**
 * Decides the settings for one repository from three layers: the built-in
 * defaults, the personal file and the repository's own file.
 *
 * The highest layer that declares a section owns the whole section, and
 * anything that section leaves out comes from the built-in defaults, never
 * from a lower file. Sections never merge key by key, so a personal file
 * cannot add a person to a repository's team.
 *
 * @param personal The personal file's sections, when it exists. An invalid
 * personal file has no sections to give, so it never reaches this point.
 * @param repository The outcome of reading the repository's file, when it
 * has one.
 */
export default function resolveSettings(
  personal: Layer | undefined,
  repository: FileOutcome | undefined,
): Resolved {
  const repositoryErrors = repository?.ok === false ? repository.errors : [];
  const layers: [Origin, Layer][] = [];
  if (repository?.ok) layers.push(["repository", repository.layer]);
  if (personal) {
    // An invalid repository file falls back to the built-in defaults, not
    // to the personal file, for every section it may declare.
    const shadowed =
      repositoryErrors.length > 0 ? sectionsByPlace.repository : [];
    const kept = Object.entries(personal).filter(
      ([section]) => !shadowed.includes(section as Section),
    );
    layers.push(["personal", Object.fromEntries(kept) as Layer]);
  }
  const origins = {} as Record<Section, Origin>;
  const declared = <S extends Section>(section: S): Layer[S] => {
    const owner = layers.find(([, layer]) => layer[section] !== undefined);
    origins[section] = owner?.[0] ?? "built-in";
    return owner?.[1][section];
  };
  const builtIn = builtInSettings;
  const time = declared("time");
  const targets = declared("targets");
  const exempt = declared("exempt");
  const settings: Settings = {
    repos: declared("repos") ?? builtIn.repos,
    people: declared("people") ?? builtIn.people,
    time: { ...builtIn.time, ...time },
    targets: {
      nextMove: { ...builtIn.targets.nextMove, ...targets?.nextMove },
      close: { ...builtIn.targets.close, ...targets?.close },
    },
    exempt: { ...builtIn.exempt, ...exempt },
    activity: declared("activity") ?? builtIn.activity,
    hosts: declared("hosts") ?? builtIn.hosts,
  };
  return { settings, origins, repositoryErrors };
}
