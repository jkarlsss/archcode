import { tool } from "ai";
import { z } from "zod";

export const Mode = {
  BUILD: "BUILD",
  PLAN: "PLAN",
} as const;

export const modeSchema = z.enum([Mode.BUILD, Mode.PLAN]);

export type ModeType = (typeof Mode)[keyof typeof Mode];

export const toolInputSchemas = {
  readFile: z.object({
    path: z.string().describe("Relative path to the file to read to"),
  }),
  listDirectory: z.object({
    path: z
      .string()
      .default(".")
      .describe("Relative path to the directory to list"),
  }),
  glob: z.object({
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
  grep: z.object({
    pattern: z.string().min(1).describe("Text or regex pattern to search for"),
    path: z
      .string()
      .min(1)
      .describe(
        "Relative path to the directory to search in (default project root)",
      )
      .default("."),
    include: z
      .string()
      .describe(
        "Optional glob for files to include (e.g. '**/*.ts', 'src/**/*.tsx')",
      )
      .optional(),
  }),
  writeFile: z.object({
    path: z.string().describe("Relative path to the file to write to"),
    content: z.string().describe("The content to write to the file"),
  }),
  editFile: z.object({
    path: z.string().describe("Relative path to the file to edit"),
    oldString: z
      .string()
      .min(1)
      .describe(
        "The exact text to find and replace (must be unique in the file)",
      ),
    newString: z.string().describe("The text to replace the oldString with"),
  }),
  bash: z.object({
    command: z.string().describe("The shell command to execute"),
    description: z
      .string()
      .optional()
      .describe("The description of the command"),
    timeout: z.number().optional().describe("The timeout in miliseconds"),
  }),
} as const;

export const readOnlyToolContracts = {
  readFile: tool({
    description: "Read a file from the current project directory",
    inputSchema: toolInputSchemas.readFile,
  }),
  listDirectory: tool({
    description: "List entries in the current project directory",
    inputSchema: toolInputSchemas.listDirectory,
  }), 
  glob: tool({
    description: "Find files matching a glob pattern under the current project directory",
    inputSchema: toolInputSchemas.glob,
  }),
  grep: tool({
    description: "Search file contents with a regular expression under the current project directory",
    inputSchema: toolInputSchemas.grep,
  }),
} as const;

export const buildToolContracts = {
  ...readOnlyToolContracts,
  writeFile: tool({
    description: "Create or overwrite a file in the current project directory",
    inputSchema: toolInputSchemas.writeFile,
  }),
  editFile: tool({
    description: "Replace exact text in a file in the current project directory",
    inputSchema: toolInputSchemas.editFile,
  }),
  bash: tool({
    description: "Execute a shell command in the current project directory",
    inputSchema: toolInputSchemas.bash,
  }),
} as const;

export type ToolContracts = typeof buildToolContracts;

export function getToolContracts (mode: ModeType) {
  return mode === Mode.BUILD ? buildToolContracts : readOnlyToolContracts;
}