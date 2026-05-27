import type { Command, CommandContext } from "./types";

export const COMMANDS: Command[] = [
  {
    name: "new",
    description: "Create a new conversation",
    value: "/new",
  },
  {
    name: "agents",
    description: "Select an AI agent",
    value: "/agents",
  },
  {
    name: "models",
    description: "Select an AI model",
    value: "/models",
  },
  {
    name: "sessions",
    description: "Manage your conversations",
    value: "/sessions",
  },
  {
    name: "theme",
    description: "Change color theme",
    value: "/theme",
  },
  {
    name: "logout",
    description: "Log out of your account",
    value: "/logout",
  },
  {
    name: "upgrade",
    description: "Buy more credits",
    value: "/upgrade",
  },
  {
    name: "usage",
    description: "Open billing portal in your browser",
    value: "/usage",
  },
  {
    name: "exit",
    description: "Exit the application",
    value: "/exit",
    action: (ctx: CommandContext) => {
      ctx.exit();
    },
  },
];
