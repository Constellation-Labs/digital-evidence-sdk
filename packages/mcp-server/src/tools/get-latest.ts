import { z } from "zod";
import type { DedApiClient } from "../api-client.js";

export const name = "ded_get_latest_fingerprints";
export const description =
  "Get the most recently submitted fingerprints. Optionally filter by batch status (e.g., NEW, PENDING_COMMITMENT, FINALIZED_COMMITMENT).";

export const inputSchema = z.object({
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .default(10)
    .describe("Maximum number of fingerprints to return (1-100)"),
  status: z
    .array(z.string())
    .optional()
    .describe(
      "Filter by batch status: NEW, PENDING_COMMITMENT, FINALIZED_COMMITMENT, ERRORED_COMMITMENT"
    ),
});

export function register(client: DedApiClient) {
  return async (args: z.infer<typeof inputSchema>) => {
    const results = await client.getLatest(args.limit, args.status);
    return {
      content: [
        { type: "text" as const, text: JSON.stringify(results, null, 2) },
      ],
    };
  };
}
