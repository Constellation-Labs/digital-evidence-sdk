import { z } from "zod";
import { fingerprintSubmissionSchema } from "../types/fingerprint-schema.js";
export const name = "ded_submit_fingerprints";
export const description = "Submit signed fingerprints for cryptographic notarization on the Constellation Network metagraph. Requires an API key. Each fingerprint must include an attestation with content and at least one signature proof.";
export const inputSchema = z.object({
    fingerprints: z
        .array(fingerprintSubmissionSchema)
        .min(1)
        .max(100)
        .describe("Array of fingerprint submissions (1-100)"),
});
export function register(client) {
    return async (args) => {
        const results = await client.submitFingerprints(args.fingerprints);
        return {
            content: [
                { type: "text", text: JSON.stringify(results, null, 2) },
            ],
        };
    };
}
//# sourceMappingURL=submit-fingerprints.js.map