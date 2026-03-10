import { z } from "zod";
import type { DedApiClient } from "../api-client.js";

export const name = "ded_track_fingerprint";
export const description =
  "Track the lifecycle status of a fingerprint in natural language. Returns a human-friendly status string explaining where the fingerprint is in the processing pipeline. Call this after ded_submit_fingerprints, ded_notarize, or ded_notarize_document to confirm submission status. Use ded_verify_proof once finalized to validate the on-chain proof.";

export const inputSchema = z.object({
  hash: z
    .string()
    .regex(/^[0-9a-fA-F]{64}$/, "Must be a 64-character hex SHA-256 hash")
    .describe("The SHA-256 hash of the fingerprint"),
});

export function register(client: DedApiClient) {
  return async (args: z.infer<typeof inputSchema>) => {
    const fp = await client.getFingerprint(args.hash);
    if (!fp) {
      return {
        content: [
          {
            type: "text" as const,
            text: `NOT FOUND — No fingerprint exists with hash ${args.hash}`,
          },
        ],
        isError: true,
      };
    }

    let status: string;

    if (!fp.batchId) {
      status = "SUBMITTED — Waiting to be assigned to a batch";
    } else {
      const batch = await client.getBatch(fp.batchId);
      if (!batch) {
        status = `BATCHED — Assigned to batch ${fp.batchId}, but batch details unavailable`;
      } else if (batch.status === "FINALIZED_COMMITMENT") {
        const parts = [`FINALIZED — Confirmed on-chain`];
        if (batch.globalSnapshotOrdinal) {
          parts.push(`at global snapshot ordinal ${batch.globalSnapshotOrdinal}`);
        }
        if (batch.globalSnapshotHash) {
          parts.push(`(hash ${batch.globalSnapshotHash})`);
        }
        if (fp.mptRoot) {
          parts.push(`with MPT root ${fp.mptRoot}`);
        }
        status = parts.join(" ");
      } else if (batch.status === "ERRORED_COMMITMENT") {
        status = `ERROR — Batch ${fp.batchId} errored after ${batch.retryCount} retries`;
      } else {
        status = `BATCHED — In batch ${fp.batchId}, batch status: ${batch.status}`;
      }
    }

    return {
      content: [{ type: "text" as const, text: status }],
    };
  };
}
