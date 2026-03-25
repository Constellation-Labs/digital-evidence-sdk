import { createHash } from "crypto";
import { z } from "zod";
import { hashDocument, canonicalize } from "@constellation-network/digital-evidence-sdk";

export const name = "ded_prepare_unsigned_fingerprint";
export const description =
  "Build a complete unsigned FingerprintValue JSON and metadata hash. Returns everything needed to sign locally " +
  "without requiring a private key on the server. Does not call the API or consume credits. " +
  "Alternative: if you have DED_SIGNING_PRIVATE_KEY configured, use ded_prepare_fingerprint instead to sign in one step.";

export const inputSchema = z.object({
  content: z
    .string()
    .describe("The document content to notarize (will be SHA-256 hashed)"),
  orgId: z.string().uuid().describe("Organization UUID"),
  tenantId: z.string().uuid().describe("Tenant UUID"),
  documentId: z
    .string()
    .optional()
    .describe("Optional document identifier (defaults to SHA-256 hash of content)"),
  tags: z
    .record(z.string())
    .optional()
    .describe("Optional key-value metadata tags (max 6 pairs)"),
});

export function register() {
  return async (args: z.infer<typeof inputSchema>) => {
    const contentHash = hashDocument(args.content);
    const documentId = args.documentId ?? contentHash;
    const eventId = crypto.randomUUID();
    const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");

    const fingerprintValue = {
      documentId,
      documentRef: contentHash,
      eventId,
      orgId: args.orgId,
      tenantId: args.tenantId,
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
