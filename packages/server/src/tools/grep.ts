import { tool } from "ai";
import { readdir, readFile, stat } from "fs/promises";
import { isAbsolute, relative, resolve } from "path";
import { z } from "zod";

const IGNORED_DIRS = new Set(["node_modules"]);
const MAX_RESULT = 1000;
const MAX_FILE_BYTES = 1_000_000; // skip files larger than ~1MB

function normalizePath(filePath: string) {
  return filePath.split(/[\\/]+/).join("/");
}

function escapeRegExp(value: string) {
  return value.replace(/[.+^${}()|[\]\\]/g, "\\$&");
}

function globToRegExp(pattern: string) {
  const normalized = pattern.split(/[\\/]+/).join("/");
  const escaped = escapeRegExp(normalized)
    .replace(/\\\*\\\*/g, ".*")
    .replace(/\\\*/g, "[^/]*")
    .replace(/\\\?/g, "[^/]");
  return new RegExp(`^${escaped}$`);
}

interface Match {
  file: string;
  line: number;
  text: string;
}

async function searchFiles(
  root: string,
  dir: string,
  searchRegex: RegExp,
  includeRegex: RegExp | undefined,
  maxResults: number = MAX_RESULT,
): Promise<Match[]> {
  const matches: Match[] = [];
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (matches.length >= maxResults) {
      break;
    }

    if (entry.name.startsWith(".") || IGNORED_DIRS.has(entry.name)) {
      continue;
    }

    const entryPath = resolve(dir, entry.name);
    if (entry.isDirectory()) {
      const subMatches = await searchFiles(
        root,
        entryPath,
        searchRegex,
        includeRegex,
        maxResults - matches.length,
      );
      matches.push(...subMatches);
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    try {
      // Optionally filter by filename before reading
      const relativePath = normalizePath(relative(root, entryPath));
      if (includeRegex && !includeRegex.test(relativePath)) {
        continue;
      }

      // Skip large files by size
      try {
        const s = await stat(entryPath);
        if (s.size > MAX_FILE_BYTES) {
          continue;
        }
      } catch {
        // ignore stat errors and try reading
      }

      const content = await readFile(entryPath, "utf-8");
      // skip binary files that contain NUL
      if (content.indexOf("\0") !== -1) continue;

      const lines = content.split("\n");

      for (let i = 0; i < lines.length && matches.length < maxResults; i++) {
        const line = lines[i];
        if (line !== undefined && searchRegex.test(line)) {
          matches.push({
            file: relativePath,
            line: i + 1,
            text: line.trim(),
          });
        }
      }
    } catch (err) {
      // Skip files that cannot be read
      continue;
    }
  }

  return matches;
}

export function createGrepTool(cwd: string) {
  return tool({
    description:
      "Search for text patterns in files. Returns matching lines with file path and line number. Skips node_modules, binary files, and hidden directories.",
    inputSchema: z.object({
      pattern: z
        .string()
        .min(1)
        .describe("Text or regex pattern to search for"),
      isRegex: z
        .boolean()
        .optional()
        .default(false)
        .describe(
          "Whether the pattern is a regular expression (default: false, literal search)",
        ),
      path: z
        .string()
        .min(1)
        .describe(
          "Relative path to the directory to search in (default project root)",
        )
        .default("."),
      include: z
        .string()
        .describe("Glob pattern to filter (e.g. '*.ts', '*.tsx')")
        .optional(),
    }),
    execute: async ({ path, pattern, include, isRegex }) => {
      const resolvedPath = resolve(cwd, path);
      const searchRelative = relative(cwd, resolvedPath);

      if (searchRelative.startsWith("..") || isAbsolute(searchRelative)) {
        return {
          success: false,
          error: "Path must be within the project root",
        };
      }
      try {
        // build include filter regex if provided
        const includeRegex = include ? globToRegExp(include) : undefined;

        // construct search regex: default literal, case-insensitive; or use provided regex
        let searchRegex: RegExp;
        if (isRegex) {
          searchRegex = new RegExp(pattern);
        } else {
          searchRegex = new RegExp(escapeRegExp(pattern), "i");
        }

        const matches = await searchFiles(
          cwd,
          resolvedPath,
          searchRegex,
          includeRegex,
          MAX_RESULT,
        );

        matches.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);

        return {
          success: true,
          matches,
          ...(matches.length >= MAX_RESULT ? { truncated: true } : {}),
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
