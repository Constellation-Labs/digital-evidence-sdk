import { createHash } from "crypto";
import { z } from "zod";
import { canonicalize } from "@constellation-network/digital-evidence-sdk";

export const name = "ded_sign_local";
export const description =
  "Generate a shell command to sign a FingerprintValue locally using the ded-sign.js script. " +
  "Supports hex keys and PEM files. Does not require an API key or private key on the server. " +
  "Alternative: if you have DED_SIGNING_PRIVATE_KEY configured, use ded_sign_fingerprint to sign directly in-process.";

export const inputSchema = z.object({
  fingerprintValue: z
    .record(z.unknown())
    .describe(
      "The FingerprintValue JSON object to sign. Must include: orgId, tenantId, eventId, documentId, documentRef, timestamp, version. " +
      "Should include signerId (128-char public key hex) for signature verification."
    ),
  privateKeyPath: z
    .string()
    .describe("Path to the private key file (.pem or .key) or a 64-char hex private key"),
});

function shellEscapeSingle(s: string): string {
  return s.replace(/'/g, "'\\''");
}

export function register() {
  return async (args: z.infer<typeof inputSchema>) => {
    const canonical = canonicalize(args.fingerprintValue);
    const metadataHash = createHash("sha256")
      .update(canonical, "utf8")
      .digest("hex");

    const escapedJson = shellEscapeSingle(canonical);
    const escapedKey = shellEscapeSingle(args.privateKeyPath);
    const command = `node ded-sign.js sign '${escapedKey}' '${escapedJson}'`;

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              command,
              canonicalJson: canonical,
              metadataHash,
              instructions:
                "1. Save the ded://tools/signing-script resource as ded-sign.js\n" +
                "2. IMPORTANT: The FingerprintValue MUST include a 'signerId' field (your 128-char public key hex) " +
                "for signature verification to pass. If missing, run: node ded-sign.js keygen to get your public key.\n" +
                "3. Save the command to a file (e.g. sign.sh) and run: bash sign.sh\n" +
                "   IMPORTANT: Do NOT paste the command inline in a shell — the JSON may trigger shell expansion.\n" +
                "   Alternatively, write the canonical JSON to a file and use: node ded-sign.js sign <key> \"$(cat fp.json)\"\n" +
                "4. Use the proof in the attestation.proofs array when submitting via ded_submit_fingerprints",
            },
            null,
            2
          ),
        },
      ],
    };
  };
}
