import { z } from "zod";
export const name = "ded_sign_fingerprint";
export const description = "Sign a FingerprintValue using the SECP256K1_RFC8785_V1 protocol (RFC 8785 canonical JSON + SECP256K1). Requires DED_SIGNING_PRIVATE_KEY to be configured. Returns a SignatureProof that can be used with ded_submit_fingerprints.";
export const inputSchema = z.object({
    fingerprintValue: z
        .object({
        orgId: z.string().uuid(),
        tenantId: z.string().uuid(),
        eventId: z.string().uuid(),
        signerId: z.string().optional(),
        documentId: z.string(),
        documentRef: z.string(),
        timestamp: z.string(),
        version: z.number().int(),
    })
        .describe("The FingerprintValue object to sign"),
});
export function register(privateKey) {
    return async (args) => {
        const { signFingerprint } = await import("../signing.js");
        const proof = await signFingerprint(args.fingerprintValue, privateKey);
        return {
            content: [
                { type: "text", text: JSON.stringify(proof, null, 2) },
            ],
        };
    };
}
//# sourceMappingURL=sign-fingerprint.js.map