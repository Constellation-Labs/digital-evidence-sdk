import { z } from "zod";
import type { DedApiClient } from "../api-client.js";
export declare const name = "ded_get_fingerprint";
export declare const description = "Get full details of a fingerprint by its SHA-256 hash, including signature proofs, batch info, and metadata.";
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
//# sourceMappingURL=get-fingerprint.d.ts.map