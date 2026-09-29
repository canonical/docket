import type { Owner, PersonGroup } from "../owed/index.js";
import { tokens } from "../tokens/index.js";
import trimText from "./trimText.js";
import type { Piece } from "./types.js";

/**
 * Each group's mark and hue. The fill reads as distance from you: the
 * ringed dot is you, the full dot the team, the half dot the
 * organisation, the empty ring outside, and the square is not a person.
 * The marks differ in shape, so they carry the group where the hues
 * merge, as blue and purple do under red-green colour blindness.
 */
const looks: Readonly<Record<PersonGroup, readonly [string, string]>> = {
  you: [tokens["glyph.you"], tokens["color.text.team"]],
  team: [tokens["glyph.team"], tokens["color.text.team"]],
  internal: [tokens["glyph.internal"], tokens["color.text.internal"]],
  outside: [tokens["glyph.outside"], tokens["color.text.outside"]],
  bot: [tokens["glyph.bot"], tokens["color.text.muted"]],
};

/**
 * A login as every list draws it: its group's mark, a space, then the
 * login cut to `cells` display cells, all in the group's hue. The login
 * gives way and the mark never does, so a bot never passes for a person.
 * An owner that names no person, such as `unassigned` or a team the
 * viewer is not in, stays plain text.
 */
export default function markPerson(owner: Owner, cells: number): Piece {
  const login = trimText(owner.text, cells);
  if (!("group" in owner)) return { text: login, fg: tokens["color.text"] };
  const [mark, hue] = looks[owner.group];
  return { text: `${mark} ${login}`, fg: hue };
}
