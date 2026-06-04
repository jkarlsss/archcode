import { tool } from "ai";
import { readdir } from "fs/promises";
import { isAbsolute, relative, resolve } from "path";
import { z } from "zod";

const IGNORED_DIRS = new Set(["node_modules"]);
const MAX_RESULT = 1000;

function normalizePath(filePath: string) {
  return filePath.split(/[\\/]+/).join("/");
}

function escapeRegExp(value: string) {
  return value.replace(/[.+^${}()|[\]\\]/g, "\\$&");
}

function globToRegExp(pattern: string) {
  const normalized = normalizePath(pattern);
  const escaped = escapeRegExp(normalized)
    .replace(/\\\*\\\*/g, ".*")
    .replace(/\\\*/g, "[^/]*")
    .replace(/\\\?/g, "[^/]");
  return new RegExp(`^${escaped}$`);
}

async function walkDir(
  root: string,
  dir: string,
  matcher: RegExp,
  maxResults: number = MAX_RESULT,
) {
  const found: string[] = [];
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (found.length >= maxResults) {
      break;
    }

    if (entry.name.startsWith(".") || IGNORED_DIRS.has(entry.name)) {
      continue;
    }

    const entryPath = resolve(dir, entry.name);
    if (entry.isDirectory()) {
      const subResults = await walkDir(
        root,
        entryPath,
        matcher,
        maxResults - found.length,
      );
      found.push(...subResults);
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    const relativePath = normalizePath(relative(root, entryPath));
    if (matcher.test(relativePath)) {
      found.push(relativePath);
    }
  }

  return found;
}

export function createGlobTool(cwd: string) {
  return tool({
    description:
      "Find files matching a glob pattern. Returns file paths relative to the project root. Skips node_modules and hidden directories.",
    inputSchema: z.object({
      pattern: z
        .string()
        .min(1)
        .describe("Glob pattern to match (e.g. '**/*.ts', 'src/**/*.tsx')"),
      path: z
        .string()
        .min(1)
        .describe(
          "Relative path to the directory to search in (default project root)",
        )
        .default("."),
    }),
    execute: async ({ path, pattern }) => {
      const resolvedPath = resolve(cwd, path);
      const searchRelative = relative(cwd, resolvedPath);

      if (searchRelative.startsWith("..") || isAbsolute(searchRelative)) {
        return {
          success: false,
          error: `Invalid path: ${path}`,
        };
      }

      try {
        const matcher = globToRegExp(pattern);
        const files = await walkDir(cwd, resolvedPath, matcher, MAX_RESULT);
        files.sort();

        return {
          success: true,
          files,
          ...(files.length >= MAX_RESULT ? { truncated: true } : {}),
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },
  });
}
