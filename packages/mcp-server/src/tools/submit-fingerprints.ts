import { z } from "zod";
import type { DedApiClient } from "../api-client.js";
import type { FingerprintSubmission } from "../types/fingerprint.js";
import { fingerprintSubmissionSchema } from "../types/fingerprint-schema.js";
import { formatPaymentOr } from "./x402-helpers.js";

export const name = "ded_submit_fingerprints";
export const description =
  "Submit signed fingerprints for cryptographic notarization on the Constellation Network metagraph. Requires API key or x402 payment. Chain: use ded_prepare_fingerprint first to build submissions, pass them here exactly as returned, then ded_track_fingerprint to monitor status. For simpler flows, prefer ded_notarize (text) or ded_notarize_document (files) which handle everything in one call.";

export const inputSchema = z.object({
  fingerprints: z
    .array(fingerprintSubmissionSchema)
    .min(1)
    .max(100)
    .describe("Array of fingerprint submissions (1-100)"),
  paymentSignature: z
    .string()
    .optional()
    .describe(
      "Base64-encoded x402 PaymentPayload for pay-per-request (omit if using API key)"
    ),
});

export function register(client: DedApiClient) {
  return async (args: z.infer<typeof inputSchema>) => {
    const result = await client.submitFingerprints(
      args.fingerprints as FingerprintSubmission[],
      args.paymentSignature
    );
    return formatPaymentOr(result);
  };
}
