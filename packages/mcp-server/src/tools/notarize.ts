import { generateFingerprint, hashDocument } from "@constellation-network/digital-evidence-sdk";
import { z } from "zod";
import type { DedApiClient } from "../api-client.js";

export const name = "ded_notarize";
export const description =
  "All-in-one notarization for text or small content: hashes the content string, builds a FingerprintSubmission, signs it, and submits to the DED API. For file uploads (images, PDFs, binary files), use ded_prepare_fingerprint + ded_upload_document instead. Requires DED_SIGNING_PRIVATE_KEY and either DED_API_KEY or x402 payment.";

export const inputSchema = z.object({
  content: z.string().describe("The raw document text to notarize"),
  orgId: z.string().uuid().describe("Organization UUID"),
  tenantId: z.string().uuid().describe("Tenant UUID"),
  documentRef: z
    .string()
    .optional()
    .describe("Hex-encoded document reference. Defaults to the SHA-256 hash of the content when omitted."),
  tags: z
    .record(z.string())
    .optional()
    .describe("Optional metadata tags as key-value pairs"),
  paymentSignature: z
    .string()
    .optional()
    .describe(
      "Base64-encoded x402 PaymentPayload for pay-per-request (omit if using API key)"
    ),
});

export function register(privateKey: string, client: DedApiClient) {
  return async (args: z.infer<typeof inputSchema>) => {
    const submission = await generateFingerprint(
      {
        orgId: args.orgId,
        tenantId: args.tenantId,
        eventId: crypto.randomUUID(),
        documentId: hashDocument(args.content),
        documentRef: args.documentRef ?? hashDocument(args.content),
        includeMetadata: true,
        tags: args.tags,
      },
      privateKey
    );

    const result = await client.submitFingerprints(
      [submission],
      args.paymentSignature
    );

    if (result.kind === "payment_required") {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                x402PaymentRequired: true,
                ...result.payment,
                submission,
                instructions:
                  "Authorize payment for the amount shown, then re-invoke this tool with paymentSignature set to the base64-encoded PaymentPayload. See ded://docs/x402-payment for details.",
              },
              null,
              2
            ),
          },
        ],
      };
    }

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            { submission, results: result.data },
            null,
            2
          ),
        },
      ],
    };
  };
}
