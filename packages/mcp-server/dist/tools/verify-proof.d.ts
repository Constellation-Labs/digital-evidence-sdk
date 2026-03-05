import { z } from "zod";
import type { DedApiClient } from "../api-client.js";
export declare const name = "ded_verify_proof";
export declare const description = "Verify the Merkle Patricia Trie inclusion proof for a fingerprint. Fetches the proof, validates its structure, and checks it against the batch root.";
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
    isError: boolean;
} | {
    content: {
        type: "text";
        text: string;
    }[];
    isError?: undefined;
}>;
//# sourceMappingURL=verify-proof.d.ts.map