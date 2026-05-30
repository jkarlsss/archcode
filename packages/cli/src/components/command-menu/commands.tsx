import { ThemeDialogContent } from "../../dialogs";
import type { Command, CommandContext } from "./types";

export const COMMANDS: Command[] = [
  {
    name: "new",
    description: "Create a new conversation",
    value: "/new",
    action: (ctx) => {
      ctx.toast.show({ message: "Starting a new conversation..." });
    }
  },
  {
    name: "agents",
    description: "Select an AI agent",
    value: "/agents",
    action: (ctx) => {
      ctx.dialog.open({ title: "Select an AI agent", children: <text>Agent selection coming soon...</text> });
    }
  },
  {
    name: "models",
    description: "Select an AI model",
    value: "/models",
    action: (ctx) => {
      ctx.dialog.open({ title: "Select an AI model", children: <text>Model selection coming soon...</text> });
    }
  },
  {
    name: "sessions",
    description: "Manage your conversations",
    value: "/sessions",
    action: (ctx) => {
      ctx.toast.show({ message: "Opening sessions..." });
    }
  },
  {
    name: "theme",
    description: "Change color theme",
    value: "/theme",
    action: (ctx) => {
      ctx.dialog.open({ title: "Select a theme", children: <ThemeDialogContent /> });
    }
  },
  {
    name: "login",
    description: "Log in to your account",
    value: "/login",
    action: (ctx) => {
      ctx.toast.show({ message: "Logging in..." });
    }
  },
  {
    name: "logout",
    description: "Log out of your account",
    value: "/logout",
    action: (ctx) => {
      ctx.toast.show({ message: "Logging out..." });
    }
  },
  {
    name: "upgrade",
    description: "Buy more credits",
    value: "/upgrade",
    action: (ctx) => {
      ctx.toast.show({ message: "Upgrading..." });
    }
  },
  {
    name: "usage",
    description: "Open billing portal in your browser",
    value: "/usage",
    action: (ctx) => {
      ctx.toast.show({ message: "Opening billing portal..." });
    }
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
