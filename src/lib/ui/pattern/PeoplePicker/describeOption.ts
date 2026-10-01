import { tokens } from "../../../tokens/index.js";
import { fitField, markPerson, measureText } from "../../fit/index.js";
import type { Piece } from "../../types.js";
import type { PickerOption } from "./types.js";

/**
 * The lines of one option in `room` cells: its box, ticked or not, then
 * the person or team behind their mark, whole. A name too long for its
 * line wraps under itself, between characters, so two teams that share
 * a long beginning still read apart where one is picked.
 */
export default function describeOption(
  { owner, ticked }: PickerOption,
  room: number,
): Piece[][] {
  const box: Piece = {
    text: `${tokens[ticked ? "glyph.ticked" : "glyph.unticked"]} `,
    fg: tokens["color.text"],
  };
  const person = markPerson(owner);
  const name = fitField(owner, "block", Number.POSITIVE_INFINITY).join(" ");
  // The mark and the space after it, before the name.
  const mark = person.text.slice(0, person.text.length - name.length);
  const indent = measureText(box.text) + measureText(mark);
  const [first, ...rest] = fitField(owner, "block", room - indent);
  return [
    [box, { ...person, text: `${mark}${first}` }],
    ...rest.map((text) => [
      { text: " ".repeat(indent), fg: tokens["color.text"] },
      { ...person, text },
    ]),
  ];
}
