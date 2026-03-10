import { readFileSync } from "fs";
import { createHash } from "crypto";
import { generateFingerprint, hashDocument } from "@constellation-network/digital-evidence-sdk";
import { z } from "zod";

export const name = "ded_prepare_fingerprint";
export const description =
  "Hash, sign, and assemble a complete FingerprintSubmission in one step. Accepts either text content or a file path (for binary files like images/PDFs). Requires DED_SIGNING_PRIVATE_KEY. IMPORTANT: Pass the returned JSON to ded_submit_fingerprints or ded_upload_document exactly as-is — do NOT modify any fields, as this invalidates the signature. Do NOT compute hashes yourself — this tool handles it. Chain: prepare here → ded_submit_fingerprints (notarize only) or ded_upload_document (notarize + store file) → ded_track_fingerprint. For simpler flows, prefer ded_notarize (text) or ded_notarize_document (files).";

export const inputSchema = z.object({
  content: z
    .string()
    .optional()
    .describe("Raw text content to notarize (mutually exclusive with filePath)"),
  filePath: z
    .string()
    .optional()
    .describe("Absolute path to a file to notarize — hashes raw bytes (mutually exclusive with content)"),
  orgId: z.string().uuid().describe("Organization UUID"),
  tenantId: z.string().uuid().describe("Tenant UUID"),
  documentRef: z
    .string()
    .optional()
    .describe("Hex-encoded document reference. Defaults to the computed SHA-256 hash when omitted."),
  tags: z
    .record(z.string())
    .optional()
    .describe("Optional metadata tags as key-value pairs"),
});

export function register(privateKey: string) {
  return async (args: z.infer<typeof inputSchema>) => {
    let docHash: string;
    if (args.filePath) {
      const fileBytes = readFileSync(args.filePath);
      docHash = createHash("sha256").update(fileBytes).digest("hex");
    } else if (args.content) {
      docHash = hashDocument(args.content);
    } else {
      throw new Error("Either content or filePath must be provided");
    }

    const submission = await generateFingerprint(
      {
        orgId: args.orgId,
        tenantId: args.tenantId,
        eventId: crypto.randomUUID(),
        documentId: docHash,
        documentRef: args.documentRef ?? docHash,
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
