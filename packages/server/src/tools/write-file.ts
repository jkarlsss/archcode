import { tool } from "ai";
import { mkdir, writeFile } from "fs/promises";
import { dirname, relative, resolve } from "path";
import { z } from "zod";

export function createWriteFileTool(cwd: string) {
  return tool({
    description: 
    "Create or overwrite a file in a project. Creates parent directories if they don't exist.",
    inputSchema: z.object({
      path: z.string().describe("Relative path to the file to write to"),
      content: z.string().describe("The content to write to the file"),
    }),
    execute: async ({ path, content }) => {
      const resolvedPath = resolve(cwd, path);

      if (!resolvedPath.startsWith(cwd)) {
        return {
          success: false,
          error: "Path must be within the project root",
        };
      }

      try {
        await mkdir(dirname(resolvedPath), { recursive: true });
        await writeFile(resolvedPath, content, "utf-8");
        return {
          success: true as const,
          path: relative(cwd, resolvedPath),
          bytesWritten: Buffer.byteLength(content, "utf-8"),
        };
      } catch (error) {
        return {
          success: false,
          error: `Failed to write file: ${(error as Error).message}`,
        };
      }
    }
    })
}