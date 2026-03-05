import { z } from "zod";
import type { DedApiClient } from "../api-client.js";

export const name = "ded_get_fingerprint_proof";
export const description =
  "Get the Merkle Patricia Trie inclusion proof for a fingerprint. The fingerprint must be assigned to a batch. The proof can be used to verify the fingerprint was included in the on-chain commitment.";

export const inputSchema = z.object({
  hash: z
    .string()
    .regex(/^[0-9a-fA-F]{64}$/, "Must be a 64-character hex SHA-256 hash")
    .describe("The SHA-256 hash of the fingerprint"),
});

export function register(client: DedApiClient) {
  return async (args: z.infer<typeof inputSchema>) => {
    const proof = await client.getFingerprintProof(args.hash);
    return {
      content: [
        { type: "text" as const, text: JSON.stringify(proof, null, 2) },
      ],
    };
  };
}
