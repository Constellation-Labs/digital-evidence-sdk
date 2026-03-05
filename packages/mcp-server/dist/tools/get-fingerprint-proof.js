import { z } from "zod";
export const name = "ded_get_fingerprint_proof";
export const description = "Get the Merkle Patricia Trie inclusion proof for a fingerprint. The fingerprint must be assigned to a batch. The proof can be used to verify the fingerprint was included in the on-chain commitment.";
export const inputSchema = z.object({
    hash: z
        .string()
        .regex(/^[0-9a-fA-F]{64}$/, "Must be a 64-character hex SHA-256 hash")
        .describe("The SHA-256 hash of the fingerprint"),
});
export function register(client) {
    return async (args) => {
        const proof = await client.getFingerprintProof(args.hash);
        return {
            content: [
                { type: "text", text: JSON.stringify(proof, null, 2) },
            ],
        };
    };
}
//# sourceMappingURL=get-fingerprint-proof.js.map