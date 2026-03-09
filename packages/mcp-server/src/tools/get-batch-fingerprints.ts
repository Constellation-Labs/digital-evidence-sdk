import { z } from "zod";
import type { DedApiClient } from "../api-client.js";

export const name = "ded_get_batch_fingerprints";
export const description =
  "Get all fingerprints in a batch by batch ID. Returns summary information for each fingerprint.";

export const inputSchema = z.object({
  batchId: z.string().uuid().describe("The UUID of the batch"),
});

export function register(client: DedApiClient) {
  return async (args: z.infer<typeof inputSchema>) => {
    const result = await client.getBatchFingerprints(args.batchId);
    if (!result) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Batch not found: ${args.batchId}`,
          },
        ],
        isError: true,
      };
    }
    return {
      content: [
        { type: "text" as const, text: JSON.stringify(result, null, 2) },
      ],
    };
  };
}
