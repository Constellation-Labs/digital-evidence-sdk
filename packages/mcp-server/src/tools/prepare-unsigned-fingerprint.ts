import { createHash } from "crypto";
import { z } from "zod";
import { hashDocument, canonicalize, orgIdFromWallet, tenantIdFromWallet } from "@constellation-network/digital-evidence-sdk";

export const name = "ded_prepare_unsigned_fingerprint";
export const description =
  "Build a complete unsigned FingerprintValue JSON and metadata hash. Returns everything needed to sign locally " +
  "without requiring a private key on the server. Does not call the API or consume credits. " +
  "Provide orgId + tenantId for API key mode, or walletAddress for x402 mode (org/tenant derived from wallet). " +
  "Alternative: if you have DED_SIGNING_PRIVATE_KEY configured, use ded_prepare_fingerprint instead to sign in one step.";

export const inputSchema = z.object({
  content: z
    .string()
    .describe("The document content to notarize (will be SHA-256 hashed)"),
  orgId: z.string().uuid().optional().describe("Organization UUID (required for API key mode, derived from walletAddress for x402)"),
  tenantId: z.string().uuid().optional().describe("Tenant UUID (required for API key mode, derived from walletAddress for x402)"),
  walletAddress: z
    .string()
    .regex(/^0x[0-9a-fA-F]{40}$/)
    .optional()
    .describe("Ethereum wallet address (0x...) for x402 mode — orgId and tenantId are derived deterministically"),
  documentId: z
    .string()
    .optional()
    .describe("Optional document identifier (defaults to SHA-256 hash of content)"),
  tags: z
    .record(z.string())
    .optional()
    .describe("Optional key-value metadata tags (max 6 pairs)"),
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

export function register() {
  return async (args: z.infer<typeof inputSchema>) => {
    const { orgId, tenantId } = resolveOrgTenant(args);
    const contentHash = hashDocument(args.content);
    const documentId = args.documentId ?? contentHash;
    const eventId = crypto.randomUUID();
    const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");

    const fingerprintValue = {
      documentId,
      documentRef: contentHash,
      eventId,
      orgId,
      tenantId,
      timestamp,
      version: 1,
    };

    const canonical = canonicalize(fingerprintValue);
    const metadataHash = createHash("sha256")
      .update(canonical, "utf8")
      .digest("hex");

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              fingerprintValue,
              metadataHash,
              signingHint:
                "IMPORTANT: Before signing, you MUST add a 'signerId' field to the FingerprintValue JSON. " +
                "signerId is your 128-char uncompressed public key hex (x||y, no 04 prefix). " +
                "Option 1: Use ded_sign_local to generate a signing command. " +
                "Option 2: Use ded_prepare_fingerprint (if DED_SIGNING_PRIVATE_KEY is configured) which handles signerId automatically. " +
                "Option 3: Save the signing script from ded://tools/signing-script and sign manually.",
            },
            null,
            2
          ),
        },
      ],
    };
  };
}
