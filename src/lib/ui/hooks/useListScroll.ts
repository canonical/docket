import { useState } from "react";
import keepInView from "../keepInView.js";
import type { UseListScrollProps, UseListScrollResult } from "./types.js";

/**
 * Scrolls a list of blocks as little as it must to keep the blocks from
 * `from` to `to` whole in view, and back up as far as the blocks below
 * still fill the room once it grows. The first block shown is kept from
 * the frame before, so the list moves only when the selection would
 * leave it, and a row is never drawn without its second line.
 */
const useListScroll = <Block extends { readonly lines: number }>({
  blocks,
  from,
  to,
  room,
}: UseListScrollProps<Block>): UseListScrollResult<Block> => {
  const [first, setFirst] = useState(0);
  const top = keepInView(
    blocks.map(({ lines }) => lines),
    from,
    to,
    room,
    first,
  );
  if (top !== first) setFirst(top);
  // The first block is drawn whatever its height, cut by the region.
  let used = 0;
  return blocks.slice(top).filter(({ lines }, index) => {
    used += lines;
    return index === 0 || used <= room;
  });
};

export default useListScroll;
