import { z } from "zod";
import type { DedApiClient } from "../api-client.js";

export const name = "ded_get_fingerprint";
export const description =
  "Get full details of a fingerprint by its SHA-256 hash, including signature proofs, batch info, and metadata.";

export const inputSchema = z.object({
  hash: z
    .string()
    .regex(/^[0-9a-fA-F]{64}$/, "Must be a 64-character hex SHA-256 hash")
    .describe("The SHA-256 hash of the fingerprint"),
});

export function register(client: DedApiClient) {
  return async (args: z.infer<typeof inputSchema>) => {
    const result = await client.getFingerprint(args.hash);
    if (!result) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Fingerprint not found: ${args.hash}`,
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
