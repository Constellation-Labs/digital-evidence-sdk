import { generateFingerprint } from "@constellation-network/digital-evidence-sdk";
import { createHash } from "node:crypto";
import { z } from "zod";
import type { DedApiClient } from "../api-client.js";
import type { DocumentInput } from "../types/fingerprint.js";

export const name = "ded_notarize_document";
export const description =
  "All-in-one document notarization with upload: hashes the binary content, builds and signs a FingerprintSubmission, and uploads both the fingerprint and document to the DED API in a single call. Use this for binary files (PDF, images, etc.) that need to be stored alongside their fingerprint. For text-only notarization without document storage, use ded_notarize instead. Requires both DED_SIGNING_PRIVATE_KEY and DED_API_KEY.";

export const inputSchema = z.object({
  contentBase64: z
    .string()
    .describe("Base64-encoded document content"),
  contentType: z
    .string()
    .describe(
      "MIME type of the document (e.g. application/pdf, image/png, image/jpeg)"
    ),
  orgId: z.string().uuid().describe("Organization UUID"),
  tenantId: z.string().uuid().describe("Tenant UUID"),
  tags: z
    .record(z.string())
    .optional()
    .describe(
      "Optional metadata tags as key-value pairs (max 6 pairs, keys and values max 32 chars each)"
    ),
});

export function register(privateKey: string, client: DedApiClient) {
  return async (args: z.infer<typeof inputSchema>) => {
    // Decode and hash the document bytes
    const docBytes = Buffer.from(args.contentBase64, "base64");
    const docHash = createHash("sha256").update(docBytes).digest("hex");

    // Build, sign, and assemble the FingerprintSubmission
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

    // Upload the fingerprint + document together
    const documents: DocumentInput[] = [
      {
        documentRef: docHash,
        contentBase64: args.contentBase64,
        contentType: args.contentType,
        expectedHash: docHash,
      },
    ];

    const results = await client.uploadDocuments([submission], documents);

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({ submission, results }, null, 2),
        },
      ],
    };
  };
}
