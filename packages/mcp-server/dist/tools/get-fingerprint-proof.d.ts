import { z } from "zod";
import type { DedApiClient } from "../api-client.js";
export declare const name = "ded_get_fingerprint_proof";
export declare const description = "Get the Merkle Patricia Trie inclusion proof for a fingerprint. The fingerprint must be assigned to a batch. The proof can be used to verify the fingerprint was included in the on-chain commitment.";
export declare const inputSchema: z.ZodObject<{
    hash: z.ZodString;
}, "strip", z.ZodTypeAny, {
    hash: string;
}, {
    hash: string;
}>;
export declare function register(client: DedApiClient): (args: z.infer<typeof inputSchema>) => Promise<{
    content: {
        type: "text";
        text: string;
    }[];
}>;
//# sourceMappingURL=get-fingerprint-proof.d.ts.map