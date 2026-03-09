import { z } from "zod";
import type { DedApiClient } from "../api-client.js";

export const name = "ded_verify_proof";
export const description =
  "Verify the Merkle Patricia Trie inclusion proof for a fingerprint. Fetches the proof, validates its structure, and checks it against the batch root.";

export const inputSchema = z.object({
  hash: z
    .string()
    .regex(/^[0-9a-fA-F]{64}$/, "Must be a 64-character hex SHA-256 hash")
    .describe("The SHA-256 hash of the fingerprint to verify"),
});

export function register(client: DedApiClient) {
  return async (args: z.infer<typeof inputSchema>) => {
    const fp = await client.getFingerprint(args.hash);
    if (!fp) {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              { valid: false, message: `Fingerprint not found: ${args.hash}` },
              null,
              2
            ),
          },
        ],
        isError: true,
      };
    }

    if (!fp.batchId) {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                valid: false,
                message:
                  "Fingerprint is not yet assigned to a batch — no proof available",
              },
              null,
              2
            ),
          },
        ],
      };
    }

    let proof;
    try {
      proof = await client.getFingerprintProof(args.hash);
    } catch (err) {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                valid: false,
                message: `Failed to fetch proof: ${err instanceof Error ? err.message : String(err)}`,
              },
              null,
              2
            ),
          },
        ],
        isError: true,
      };
    }

    const batch = await client.getBatch(fp.batchId);

    const hasValidStructure =
      proof.leafKey &&
      proof.leafValue &&
      proof.root &&
      Array.isArray(proof.proof) &&
      proof.proof.length > 0;

    const rootMatchesBatch = batch?.mptRoot
      ? proof.root === batch.mptRoot
      : null;

    const valid = hasValidStructure && rootMatchesBatch !== false;

    const result = {
      valid,
      message: !hasValidStructure
        ? "Proof has invalid structure: missing required fields or empty witness list"
        : rootMatchesBatch === false
          ? `Proof root (${proof.root}) does not match batch MPT root (${batch?.mptRoot})`
          : `Proof is valid — fingerprint is included in batch ${fp.batchId} with MPT root ${proof.root}`,
      details: {
        fingerprintHash: args.hash,
        batchId: fp.batchId,
        batchStatus: batch?.status ?? "unknown",
        proofRoot: proof.root,
        batchMptRoot: batch?.mptRoot ?? null,
        witnessNodeCount: proof.proof.length,
      },
    };

    return {
      content: [
        { type: "text" as const, text: JSON.stringify(result, null, 2) },
      ],
    };
  };
}
