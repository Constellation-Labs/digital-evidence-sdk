import { z } from "zod";
import type { DedApiClient } from "../api-client.js";

export const name = "ded_get_stats";
export const description =
  "Get platform-wide fingerprint statistics including counts for the last 24 hours, 30 days, and all time.";

export const inputSchema = z.object({});

export function register(client: DedApiClient) {
  return async (_args: z.infer<typeof inputSchema>) => {
    const stats = await client.getStats();
    return {
      content: [{ type: "text" as const, text: JSON.stringify(stats, null, 2) }],
    };
  };
}
