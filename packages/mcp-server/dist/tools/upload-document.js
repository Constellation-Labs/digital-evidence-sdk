import { z } from "zod";
import { fingerprintSubmissionSchema } from "../types/fingerprint-schema.js";
export const name = "ded_upload_document";
export const description = "Upload documents with fingerprint submissions. Each document is base64-encoded and linked to a fingerprint by documentRef. Requires API key. Blocked for free tier.";
export const inputSchema = z.object({
    fingerprints: z
        .array(fingerprintSubmissionSchema)
        .min(1)
        .max(100)
        .describe("Array of fingerprint submissions (1-100)"),
    documents: z
        .array(z.object({
        documentRef: z
            .string()
            .describe("Must match a fingerprint's documentRef"),
        contentBase64: z
            .string()
            .describe("Base64-encoded document content"),
        contentType: z
            .string()
            .describe("MIME type (e.g. application/pdf)"),
        expectedHash: z
            .string()
            .regex(/^[0-9a-fA-F]{64}$/)
            .describe("SHA-256 hex of decoded content"),
    }))
        .min(1)
        .describe("Documents to upload, each linked to a fingerprint by documentRef"),
});
export function register(client) {
    return async (args) => {
        const results = await client.uploadDocuments(args.fingerprints, args.documents);
        return {
            content: [
                { type: "text", text: JSON.stringify(results, null, 2) },
            ],
        };
    };
}
//# sourceMappingURL=upload-document.js.map