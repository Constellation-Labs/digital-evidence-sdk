import { createFingerprintValue, signFingerprint, createMetadata, hashDocument, orgIdFromWallet, tenantIdFromWallet, getPublicKeyId } from "@constellation-network/digital-evidence-sdk";
import { z } from "zod";
import type { DedApiClient } from "../api-client.js";

export const name = "ded_notarize";
export const description =
  "All-in-one notarization for text or small content: hashes the content string, builds a FingerprintSubmission, signs it, and submits to the DED API. For file uploads (images, PDFs, binary files), use ded_prepare_fingerprint + ded_upload_document instead. Requires DED_SIGNING_PRIVATE_KEY and either DED_API_KEY or x402 payment. Provide orgId + tenantId for API key mode, or walletAddress for x402 mode (org/tenant derived from wallet).";

export const inputSchema = z.object({
  content: z.string().describe("The raw document text to notarize"),
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

export function register(privateKey: string, client: DedApiClient) {
  return async (args: z.infer<typeof inputSchema>) => {
    const { orgId, tenantId } = resolveOrgTenant(args);
    const publicKeyId = getPublicKeyId(privateKey);
    const value = createFingerprintValue(
      {
        orgId,
        tenantId,
        eventId: crypto.randomUUID(),
        documentId: hashDocument(args.content),
        documentRef: args.documentRef ?? hashDocument(args.content),
      },
      publicKeyId
    );
    // Normalize timestamp to match protobuf Timestamp JSON serialization
    // (google.protobuf.Timestamp strips trailing .000 when nanos=0)
    value.timestamp = value.timestamp.replace(/\.000Z$/, 'Z');
    const signed = await signFingerprint(value, privateKey);
    const metadata = createMetadata(value, args.tags);
    const submission = { attestation: signed, metadata };

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
