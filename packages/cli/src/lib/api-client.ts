import type { AppType } from "@archcode/server";
import { hc } from "hono/client";
import { clearAuth, getAuth } from "./auth";

export const apiClient = hc<AppType>(
  process.env.API_URI || "http://localhost:3000",
  {
    fetch: async (
      input: Parameters<typeof fetch>[0],
      init?: Parameters<typeof fetch>[1],
    ) => {
      const headers = new Headers(init?.headers);
      const auth = await getAuth();

      if (auth) {
        headers.set("Authorization", `Bearer ${auth.token}`);
      }

      const response = await fetch(input, {
        ...init,
        headers,
      });

      if (response.status === 401) {
        clearAuth();
      }

      return response;
    },
  },
);
