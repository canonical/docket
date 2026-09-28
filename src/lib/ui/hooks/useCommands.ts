import { useKeymap } from "@opentui/keymap/react";
import { useCallback, useEffect, useState } from "react";
import describeCommands from "./describeCommands.js";
import type { UseCommandsProps, UseCommandsResult } from "./types.js";

/**
 * The commands bound in the keymap, described for the help and the key
 * bar, and described again whenever a layer or a command changes. Both
 * read the keymap's own catalogue, so neither can drift from the keys
 * that work.
 */
const useCommands = ({ visibility }: UseCommandsProps): UseCommandsResult => {
  const keymap = useKeymap();
  const read = useCallback(
    () => describeCommands(keymap.getCommandEntries({ visibility })),
    [keymap, visibility],
  );
  const [commands, setCommands] = useState(read);
  useEffect(() => {
    setCommands(read());
    return keymap.on("state", () => setCommands(read()));
  }, [keymap, read]);
  return commands;
};

export default useCommands;
