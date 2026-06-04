import { createReadFileTool } from "./read-file.js";
import { createListDirectoryTool } from "./list-directory.js";
import { createWriteFileTool } from "./write-file.js";
import { createEditFileTool } from "./edit-file.js";
import { createGrepTool } from "./grep.js";
import { createGlobTool } from "./glob.js";
import { createBashTool } from "./bash.js";
import type { Mode } from "@archcode/database/enums";

export function createTools(cwd: string, mode: Mode) {
  const readOnlyTools = {
    readFile: createReadFileTool(cwd),
    listDirectory: createListDirectoryTool(cwd),
    grep: createGrepTool(cwd),
    glob: createGlobTool(cwd),
  };

  if (mode === "PLAN") {
    return readOnlyTools;
  }

  return {
    ...readOnlyTools,
    writeFile: createWriteFileTool(cwd),
    editFile: createEditFileTool(cwd),
    bash: createBashTool(cwd),
  }
}
