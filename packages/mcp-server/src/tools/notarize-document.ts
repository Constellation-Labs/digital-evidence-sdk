import { readFileSync } from "fs";
import { createHash } from "crypto";
import { createFingerprintValue, signFingerprint, createMetadata, orgIdFromWallet, tenantIdFromWallet, getPublicKeyId } from "@constellation-network/digital-evidence-sdk";
import { z } from "zod";
import type { DedApiClient } from "../api-client.js";

export const name = "ded_notarize_document";
export const description =
  "All-in-one file notarization: reads a file from disk, hashes the raw bytes, builds and signs a FingerprintSubmission, and submits it to the DED API. Do NOT base64-encode the file — just provide the file path. This does not upload the file for storage; use ded_upload_document separately if you also need to store the file. For text-only notarization, use ded_notarize instead. Requires DED_SIGNING_PRIVATE_KEY and either DED_API_KEY or x402 payment. Provide orgId + tenantId for API key mode, or walletAddress for x402 mode (org/tenant derived from wallet).";

export const inputSchema = z.object({
  filePath: z
    .string()
    .describe("Absolute path to the file to notarize"),
  orgId: z.string().uuid().optional().describe("Organization UUID (required for API key mode, derived from walletAddress for x402)"),
  tenantId: z.string().uuid().optional().describe("Tenant UUID (required for API key mode, derived from walletAddress for x402)"),
  walletAddress: z
    .string()
    .regex(/^0x[0-9a-fA-F]{40}$/)
    .optional()
    .describe("Ethereum wallet address (0x...) for x402 mode — orgId and tenantId are derived deterministically"),
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
    const fileBytes = readFileSync(args.filePath);
    const docHash = createHash("sha256").update(fileBytes).digest("hex");

    const publicKeyId = getPublicKeyId(privateKey);
    const value = createFingerprintValue(
      {
        orgId,
        tenantId,
        eventId: crypto.randomUUID(),
        documentId: docHash,
        documentRef: docHash,
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
          text: JSON.stringify({ submission, results: result.data }, null, 2),
        },
      ],
    };
  };
}
