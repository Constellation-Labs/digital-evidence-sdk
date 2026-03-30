import { z } from "zod";
import type { DedApiClient } from "../api-client.js";
import type { FingerprintSubmission } from "../types/fingerprint.js";
import { fingerprintSubmissionSchema } from "../types/fingerprint-schema.js";

export const name = "ded_validate_fingerprints";
export const description =
  "Dry-run validation of fingerprint submissions without actually submitting them. Requires an API key or x402 wallet. Use this to check that fingerprints are correctly formatted before submission.";

export const inputSchema = z.object({
  fingerprints: z
    .array(fingerprintSubmissionSchema)
    .min(1)
    .max(100)
    .describe("Array of fingerprint submissions to validate (1-100)"),
});

export function register(client: DedApiClient) {
  return async (args: z.infer<typeof inputSchema>) => {
    const result = await client.validateFingerprints(
      args.fingerprints as FingerprintSubmission[]
    );
    return {
      content: [
        { type: "text" as const, text: JSON.stringify(result, null, 2) },
      ],
    };
  };
}