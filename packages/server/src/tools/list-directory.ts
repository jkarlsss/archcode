import { tool } from "ai";
import { readdir, stat } from "fs/promises";
import { relative, resolve } from "path";
import { z } from "zod";

export function createListDirectoryTool(cwd: string) {
  return tool({
    description:
      "List files and directories in a project directory. Returns names with type indicators.",
    inputSchema: z.object({
      path: z
        .string()
        .describe(
          "Relative path to the directory to list (defaults to project root)",
        )
        .default("."),
    }),
    execute: async ({ path }) => {
      const resolvedPath = resolve(cwd, path);
      const rel = relative(cwd, resolvedPath);

      if (rel.startsWith("..")) {
        return {
          success: false,
          error: "Path must be within the project root",
        };
      }

      try {
        const entries = await readdir(resolvedPath);
        const results: { name: string; type: "file" | "directory" }[] = [];
        for (const entry of entries) {
          if (entry.startsWith(".") || entry === "node_modules") {
            continue;
          }

          try {
            const entryPath = resolve(resolvedPath, entry);
            const stats = await stat(entryPath);
            results.push({
              name: entry,
              type: stats.isDirectory() ? "directory" : "file",
            });
          } catch (error) {}
        }

        results.sort((a, b) => {
          if (a.type !== b.type) {
            return a.type === "directory" ? -1 : 1;
          }
          return a.name.localeCompare(b.name);
        });

        return {
          path: relative(cwd, resolvedPath) || ".",
          entries: results,
        };
      } catch (error) {
        return {
          success: false,
          error: `Failed to list directory: ${(error as Error).message}`,
        };
      }
    },
  });
}
