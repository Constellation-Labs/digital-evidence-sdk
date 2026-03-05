import { generateFingerprint, hashDocument } from "@constellation-network/digital-evidence-sdk";
import { z } from "zod";
export const name = "ded_notarize";
export const description = "All-in-one notarization: hashes the content, builds a FingerprintSubmission, signs it, computes the metadata hash, and submits it to the DED API. Returns the submission result. Requires both DED_SIGNING_PRIVATE_KEY and DED_API_KEY.";
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
export function register(privateKey, client) {
    return async (args) => {
        const submission = await generateFingerprint({
            orgId: args.orgId,
            tenantId: args.tenantId,
            eventId: crypto.randomUUID(),
            documentId: hashDocument(args.content),
            documentRef: args.documentRef,
            includeMetadata: true,
            tags: args.tags,
        }, privateKey);
        const results = await client.submitFingerprints([submission]);
        return {
            content: [
                {
                    type: "text",
                    text: JSON.stringify({ submission, results }, null, 2),
                },
            ],
        };
    };
}
//# sourceMappingURL=notarize.js.map