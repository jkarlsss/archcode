import { hc } from "hono/client";
import type { AppType } from "@archcode/server";

export const apiClient = hc<AppType>(
  process.env.API_URI || "http://localhost:3000",
)