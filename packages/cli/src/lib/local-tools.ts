import { Mode, toolInputSchemas, type ModeType } from "@archcode/shared";
import { exec } from "node:child_process";
import {
  glob,
  mkdir,
  readdir,
  readFile,
  stat,
  writeFile,
} from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";

const MAX_FILE_SIZE = 10_000;
const MAX_RESULTS = 200;
const MAX_MATCHES = 50;
const MAX_OUTPUT = 20_000;
const DEFAULT_TIMEOUT = 30_000;

function resolveInsideCwd(path: string) {
  const cwd = process.cwd();
  const resolved = resolve(cwd, path);
  const rel = relative(cwd, resolved);

  if (rel.startsWith("..") || isAbsolute(rel)) {
    throw new Error("Path is outside of the current working directory");
  }

  return { cwd, resolved };
}

function truncate(value: string, limit: number) {
  return value.length > limit
    ? `${value.slice(0, limit)}\n... (truncated, ${value.length} total chars)`
    : value;
}

export async function executeLocalTool(
  toolName: string,
  input: unknown,
  mode: ModeType,
) {
  if (
    mode === Mode.PLAN &&
    !["readFile", "listDirectory", "glob", "grep"].includes(toolName)
  ) {
    throw new Error(`Plan mode does not support ${toolName}`);
  }

  switch (toolName) {
    case "readFile": {
      const { path } = toolInputSchemas.readFile.parse(input);
      const { resolved } = resolveInsideCwd(path);
      const content = await readFile(resolved, "utf-8");
      return content.length > MAX_FILE_SIZE
        ? {
            content: content.slice(0, MAX_FILE_SIZE),
            truncated: true,
            totalLength: content.length,
          }
        : { content };
    }
    case "listDirectory": {
      const { path } = toolInputSchemas.listDirectory.parse(input);
      const { cwd, resolved } = resolveInsideCwd(path);
      const entries = await readdir(resolved);
      const results: { name: string; type: "file" | "directory" }[] = [];

      for (const entry of entries) {
        if (entry.startsWith(".") || entry === "node_modules") continue;
        const info = await stat(join(resolved, entry));
        results.push({
          name: entry,
          type: info.isDirectory() ? "directory" : "file",
        });
      }

      results.sort((a, b) =>
        a.type !== b.type
          ? a.type === "directory"
            ? -1
            : 1
          : a.name.localeCompare(b.name),
      );

      return { path: relative(cwd, resolved) || ".", entries: results };
    }
    case "glob": {
      const { path, pattern } = toolInputSchemas.glob.parse(input);
      const { cwd, resolved } = resolveInsideCwd(path);

      // Pass resolved path as the cwd context to the native glob compiler
      const globData = glob(pattern, { cwd: resolved });
      const files: string[] = [];
      let truncated = false;

      for await (const entry of globData) {
        if (entry === "node_modules") continue;

        // Resolve absolute path accurately so `stat` doesn't throw an error
        const absoluteEntryPath = resolve(resolved, entry);
        const info = await stat(absoluteEntryPath);
        if (!info.isFile()) continue;

        if (files.length >= MAX_RESULTS) {
          truncated = true;
          break;
        }

        // Return paths relative to the agent's main workspace root
        files.push(relative(cwd, absoluteEntryPath));
      }

      files.sort();
      // CRITICAL FIX: Return the structure to the LLM agent
      return { files, ...(truncated ? { truncated: true } : {}) };
    }
    case "grep": {
      const { path, pattern } = toolInputSchemas.grep.parse(input);
      const { cwd, resolved } = resolveInsideCwd(path);

      // Use glob to recursively match all files within the chosen subdirectory
      const globData = glob("**/*", { cwd: resolved });
      const matches: { filepath: string; line: number; content: string }[] = [];

      let totalCharsOutput = 0;
      let truncated = false;

      // CRITICAL FIX: Safe Regex initialization to handle LLM syntax errors
      let regex: RegExp;
      try {
        regex = new RegExp(pattern, "i");
      } catch (err) {
        return {
          error: `Invalid search pattern (Regex Syntax Error): ${(err as Error).message}`,
        };
      }

      for await (const entry of globData) {
        // CRITICAL FIX: Split path to reliably catch node_modules or hidden folders at any level
        const segments = entry.split(/[/\\]/);
        if (
          segments.some((seg) => seg === "node_modules" || seg.startsWith("."))
        ) {
          continue;
        }

        const absoluteEntryPath = resolve(resolved, entry);
        const info = await stat(absoluteEntryPath);
        if (!info.isFile()) continue;

        // Skip massive or binary files (> 1MB) to protect memory and runtime
        if (info.size > 1024 * 1024) continue;

        const content = await readFile(absoluteEntryPath, "utf-8");

        // Fast-path: skip parsing line-by-line if the pattern isn't in the file at all
        if (!regex.test(content)) continue;

        const lines = content.split(/\r?\n/);
        const relativePath = relative(cwd, absoluteEntryPath);

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i]!;

          if (regex.test(line)) {
            // Guardrails: Check if we have hit the match count or total output length limits
            if (
              matches.length >= MAX_MATCHES ||
              totalCharsOutput + line.length > MAX_OUTPUT
            ) {
              truncated = true;
              break;
            }

            matches.push({
              filepath: relativePath,
              line: i + 1,
              content: line,
            });

            totalCharsOutput += line.length;
          }
        }

        if (truncated) break;
      }

      return {
        matches,
        ...(truncated ? { truncated: true, totalMatches: matches.length } : {}),
      };
    }
    case "writeFile": {
      const { path, content } = toolInputSchemas.writeFile.parse(input);
      const { cwd, resolved } = resolveInsideCwd(path);
      await mkdir(dirname(resolved), { recursive: true });
      await writeFile(resolved, content, "utf-8");
      return {
        success: true,
        path: relative(cwd, resolved),
        bytesWritten: Buffer.byteLength(content, "utf-8"),
      };
    }
    case "editFile": {
      const { path, oldString, newString } =
        toolInputSchemas.editFile.parse(input);
      const { cwd, resolved } = resolveInsideCwd(path);
      const content = await readFile(resolved, "utf-8");
      const occurrences = content.split(oldString).length - 1;

      if (occurrences === 0) {
        throw new Error("String not found in file");
      }
      if (occurrences > 1) {
        throw new Error("Multiple occurrences of string found in file");
      }

      await writeFile(resolved, content.replace(oldString, newString), "utf-8");
      return {
        success: true as const,
        path: relative(cwd, resolved),
      };
    }
    case "bash": {
      const { command, timeout = DEFAULT_TIMEOUT } =
        toolInputSchemas.bash.parse(input);

      return new Promise((resolve) => {
        exec(
          command,
          {
            cwd: process.cwd(),
            timeout: timeout,
            // 10MB safety ceiling to prevent memory crashes before truncation occurs
            maxBuffer: 10 * 1024 * 1024,
            killSignal: "SIGKILL",
          },
          (error, stdout, stderr) => {
            // Determine exit code status or capture signal if terminated prematurely
            let exitCode: number | string | null = 0;
            if (error) {
              exitCode =
                typeof error.code === "number" ? error.code : error.signal!;
            }

            // Leverage your existing truncate utility to safeguard LLM context windows
            return resolve({
              stdout: truncate(stdout, MAX_OUTPUT),
              stderr: truncate(stderr, MAX_OUTPUT),
              exitCode,
            });
          },
        );
      });
    }
    default:
      throw new Error("Unknown tool: " + toolName);
  }
}
