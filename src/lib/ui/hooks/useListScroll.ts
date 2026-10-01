import { useState } from "react";
import placeList from "../placeList.js";
import type { UseListScrollProps, UseListScrollResult } from "./types.js";

/**
 * Scrolls a list of blocks as little as it must to keep the blocks from
 * `from` to `to` whole in view, and back up as far as the blocks below
 * still fill the room once it grows, pinning the heading of the first
 * row's group above it and counting the rows cut off below
 * (`placeList`). The first block shown is kept from the frame before, so
 * the list moves only when the selection would leave it. A list drawn
 * anew starts from `first`, so it opens where it was left.
 */
export default function useListScroll({
  blocks,
  from,
  to,
  room,
  first: start = 0,
}: UseListScrollProps): UseListScrollResult {
  const [first, setFirst] = useState(start);
  const { shown, ...placed } = placeList(blocks, { from, to, room, first });
  if (placed.first !== first) setFirst(placed.first);
  return {
    ...placed,
    shown: blocks.slice(placed.first, placed.first + shown),
  };
}
