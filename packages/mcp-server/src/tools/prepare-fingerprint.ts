import { readFileSync } from "fs";
import { createHash } from "crypto";
import { createFingerprintValue, signFingerprint, createMetadata, hashDocument, orgIdFromWallet, tenantIdFromWallet, getPublicKeyId } from "@constellation-network/digital-evidence-sdk";
import { z } from "zod";

export const name = "ded_prepare_fingerprint";
export const description =
  "Hash, sign, and assemble a complete FingerprintSubmission in one step. Accepts either text content or a file path (for binary files like images/PDFs). Requires DED_SIGNING_PRIVATE_KEY. IMPORTANT: Pass the returned JSON to ded_submit_fingerprints or ded_upload_document exactly as-is — do NOT modify any fields, as this invalidates the signature. Do NOT compute hashes yourself — this tool handles it. Chain: prepare here → ded_submit_fingerprints (notarize only) or ded_upload_document (notarize + store file) → ded_track_fingerprint. For simpler flows, prefer ded_notarize (text) or ded_notarize_document (files). Provide orgId + tenantId for API key mode, or walletAddress for x402 mode (org/tenant derived from wallet).";

export const inputSchema = z.object({
  content: z
    .string()
    .optional()
    .describe("Raw text content to notarize (mutually exclusive with filePath)"),
  filePath: z
    .string()
    .optional()
    .describe("Absolute path to a file to notarize — hashes raw bytes (mutually exclusive with content)"),
  orgId: z.string().uuid().optional().describe("Organization UUID (required for API key mode, derived from walletAddress for x402)"),
  tenantId: z.string().uuid().optional().describe("Tenant UUID (required for API key mode, derived from walletAddress for x402)"),
  walletAddress: z
    .string()
    .regex(/^0x[0-9a-fA-F]{40}$/)
    .optional()
    .describe("Ethereum wallet address (0x...) for x402 mode — orgId and tenantId are derived deterministically"),
  documentRef: z
    .string()
    .optional()
    .describe("Hex-encoded document reference. Defaults to the computed SHA-256 hash when omitted."),
  tags: z
    .record(z.string())
    .optional()
    .describe("Optional metadata tags as key-value pairs"),
});

function resolveOrgTenant(args: { orgId?: string; tenantId?: string; walletAddress?: string }): { orgId: string; tenantId: string } {
  if (args.walletAddress) {
    return {
      orgId: args.orgId ?? orgIdFromWallet(args.walletAddress),
      tenantId: args.tenantId ?? tenantIdFromWallet(args.walletAddress),
    };
  }
  if (args.orgId && args.tenantId) {
    return { orgId: args.orgId, tenantId: args.tenantId };
  }
  throw new Error("Provide either orgId + tenantId (API key mode) or walletAddress (x402 mode)");
}

export function register(privateKey: string) {
  return async (args: z.infer<typeof inputSchema>) => {
    const { orgId, tenantId } = resolveOrgTenant(args);
    let docHash: string;
    if (args.filePath) {
      const fileBytes = readFileSync(args.filePath);
      docHash = createHash("sha256").update(fileBytes).digest("hex");
    } else if (args.content) {
      docHash = hashDocument(args.content);
    } else {
      throw new Error("Either content or filePath must be provided");
    }

    const publicKeyId = getPublicKeyId(privateKey);
    const value = createFingerprintValue(
      {
        orgId,
        tenantId,
        eventId: crypto.randomUUID(),
        documentId: docHash,
        documentRef: args.documentRef ?? docHash,
      },
      publicKeyId
    );
    // Normalize timestamp to match protobuf Timestamp JSON serialization
    // (google.protobuf.Timestamp strips trailing .000 when nanos=0)
    value.timestamp = value.timestamp.replace(/\.000Z$/, 'Z');
    const signed = await signFingerprint(value, privateKey);
    const metadata = createMetadata(value, args.tags);
    const submission = { attestation: signed, metadata };

    return {
      content: [
        { type: "text" as const, text: JSON.stringify(submission, null, 2) },
      ],
    };
  };
}
