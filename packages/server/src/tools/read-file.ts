import { tool } from "ai";
import { readFile } from "fs/promises";
import { dirname, relative, resolve } from "path";
import { z } from "zod";

const MAX_FILE_SIZE = 10_000;

export function createReadFileTool(cwd: string) {
  return tool({
    description: 
    "Read the contents of a file in the project. Returns the file text, truncate if very large.",
    inputSchema: z.object({
      path: z.string().describe("Relative path to the file to write to"),
    }),
    execute: async ({ path }) => {
      const resolvedPath = resolve(cwd, path);
      const rel = relative(cwd, resolvedPath);

      if (rel.startsWith("..") || (resolve(resolvedPath) !== resolvedPath && rel.startsWith(".."))) {
        return {
          success: false,
          error: "Path must be within the project root",
        }
      }
      try {
        const content = await readFile(resolvedPath, "utf-8");

        if (content.length > MAX_FILE_SIZE) {
          return {
            success: true as const,
            path: relative(cwd, resolvedPath),
            content: content.slice(0, MAX_FILE_SIZE),
          };
        }

        return {
          content,
        };
      } catch (error) {
        return {
          success: false,
          error: `Failed to read file: ${(error as Error).message}`,
        };
      }
    }
    })
}