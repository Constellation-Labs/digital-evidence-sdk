import { generateFingerprint, hashDocument } from "@constellation-network/digital-evidence-sdk";
import { z } from "zod";
import type { DedApiClient } from "../api-client.js";

export const name = "ded_notarize";
export const description =
  "All-in-one notarization for text or small content: hashes the content string, builds a FingerprintSubmission, signs it, and submits to the DED API. For file uploads (images, PDFs, binary files), use ded_prepare_fingerprint + ded_upload_document instead. Requires both DED_SIGNING_PRIVATE_KEY and DED_API_KEY.";

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

    const results = await client.submitFingerprints([submission]);

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            { submission, results },
            null,
            2
          ),
        },
      ],
    };
  };
}
