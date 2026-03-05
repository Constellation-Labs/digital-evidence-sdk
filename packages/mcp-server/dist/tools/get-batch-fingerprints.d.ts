import { z } from "zod";
import type { DedApiClient } from "../api-client.js";
export declare const name = "ded_get_batch_fingerprints";
export declare const description = "Get all fingerprints in a batch by batch ID. Returns summary information for each fingerprint.";
export declare const inputSchema: z.ZodObject<{
    batchId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    batchId: string;
}, {
    batchId: string;
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
//# sourceMappingURL=get-batch-fingerprints.d.ts.map