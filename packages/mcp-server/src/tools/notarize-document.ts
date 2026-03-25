import { readFileSync } from "fs";
import { createHash } from "crypto";
import { generateFingerprint } from "@constellation-network/digital-evidence-sdk";
import { z } from "zod";
import type { DedApiClient } from "../api-client.js";

export const name = "ded_notarize_document";
export const description =
  "All-in-one file notarization: reads a file from disk, hashes the raw bytes, builds and signs a FingerprintSubmission, and submits it to the DED API. Do NOT base64-encode the file — just provide the file path. This does not upload the file for storage; use ded_upload_document separately if you also need to store the file. For text-only notarization, use ded_notarize instead. Requires DED_SIGNING_PRIVATE_KEY and either DED_API_KEY or x402 payment.";

export const inputSchema = z.object({
  filePath: z
    .string()
    .describe("Absolute path to the file to notarize"),
  orgId: z.string().uuid().describe("Organization UUID"),
  tenantId: z.string().uuid().describe("Tenant UUID"),
  tags: z
    .record(z.string())
    .optional()
    .describe(
      "Optional metadata tags as key-value pairs (max 6 pairs, keys and values max 32 chars each)"
    ),
  paymentSignature: z
    .string()
    .optional()
    .describe(
      "Base64-encoded x402 PaymentPayload for pay-per-request (omit if using API key)"
    ),
});

export function register(privateKey: string, client: DedApiClient) {
  return async (args: z.infer<typeof inputSchema>) => {
    const fileBytes = readFileSync(args.filePath);
    const docHash = createHash("sha256").update(fileBytes).digest("hex");

    const submission = await generateFingerprint(
      {
        orgId: args.orgId,
        tenantId: args.tenantId,
        eventId: crypto.randomUUID(),
        documentId: docHash,
        documentRef: docHash,
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
          text: JSON.stringify({ submission, results: result.data }, null, 2),
        },
      ],
    };
  };
}
