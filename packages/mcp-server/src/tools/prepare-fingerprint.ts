import { generateFingerprint, hashDocument } from "@constellation-network/digital-evidence-sdk";
import { z } from "zod";

export const name = "ded_prepare_fingerprint";
export const description =
  "Hash, sign, and assemble a complete FingerprintSubmission from raw document content in one step. Requires DED_SIGNING_PRIVATE_KEY to be configured. Returns a ready-to-submit FingerprintSubmission JSON. IMPORTANT: Pass the returned JSON to ded_submit_fingerprints exactly as-is — do NOT add, remove, or modify any fields, as this will invalidate the cryptographic signature. Prefer ded_notarize instead, which prepares and submits in a single step.";

export const inputSchema = z.object({
  content: z.string().describe("The raw document text to notarize"),
  orgId: z.string().uuid().describe("Organization UUID"),
  tenantId: z.string().uuid().describe("Tenant UUID"),
  documentRef: z
    .string()
    .describe("Document reference (e.g., filename or URI)"),
  tags: z
    .record(z.string())
    .optional()
    .describe("Optional metadata tags as key-value pairs"),
});

export function register(privateKey: string) {
  return async (args: z.infer<typeof inputSchema>) => {
    const submission = await generateFingerprint(
      {
        orgId: args.orgId,
        tenantId: args.tenantId,
        eventId: crypto.randomUUID(),
        documentId: hashDocument(args.content),
        documentRef: args.documentRef,
        includeMetadata: true,
        tags: args.tags,
      },
      privateKey
    );

    return {
      content: [
        { type: "text" as const, text: JSON.stringify(submission, null, 2) },
      ],
    };
  };
}
