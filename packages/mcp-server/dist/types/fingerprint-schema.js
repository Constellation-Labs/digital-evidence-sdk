import { z } from "zod";
export const signatureProofSchema = z.object({
    id: z
        .string()
        .regex(/^[0-9a-fA-F]+$/)
        .min(1)
        .max(140)
        .describe("Uncompressed public key hex (no 0x04 prefix)"),
    signature: z
        .string()
        .regex(/^[0-9a-fA-F]+$/)
        .min(64)
        .max(2048)
        .describe("ECDSA signature as hex string"),
    algorithm: z
        .enum(["SECP256K1_RFC8785_V1"])
        .describe("Signing algorithm"),
});
export const fingerprintValueSchema = z.object({
    orgId: z.string().uuid().describe("Organization UUID (assigned by DED platform)"),
    tenantId: z.string().uuid().describe("Tenant UUID (assigned by organization)"),
    eventId: z.string().uuid().describe("Unique event identifier (client-generated UUIDv4)"),
    signerId: z
        .string()
        .regex(/^[0-9a-fA-F]+$/)
        .min(64)
        .max(140)
        .optional()
        .describe("Optional public key in hex (no 0x prefix)"),
    documentId: z.string().min(1).max(256).describe("Document identifier"),
    documentRef: z
        .string()
        .regex(/^[0-9a-fA-F]+$/)
        .min(32)
        .max(128)
        .describe("Hex-encoded hash of document content"),
    timestamp: z
        .string()
        .datetime()
        .describe("RFC 3339 timestamp (e.g. 2025-01-15T10:30:00Z)"),
    version: z.number().int().min(1).describe("Schema version (must be >= 1)"),
});
export const metadataSchema = z.object({
    hash: z
        .string()
        .regex(/^[0-9a-fA-F]+$/)
        .min(32)
        .max(128)
        .optional()
        .describe("Hex-encoded hash of the FingerprintValue"),
    tags: z
        .record(z.string().max(32))
        .optional()
        .describe("Key-value metadata tags (max 6 pairs, keys max 32 chars)"),
});
export const fingerprintSubmissionSchema = z.object({
    attestation: z.object({
        content: fingerprintValueSchema,
        proofs: z.array(signatureProofSchema).min(1),
    }),
    metadata: metadataSchema.optional(),
});
//# sourceMappingURL=fingerprint-schema.js.map