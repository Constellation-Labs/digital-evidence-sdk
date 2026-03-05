import { z } from "zod";
import type { DedApiClient } from "../api-client.js";
export declare const name = "ded_get_batch";
export declare const description = "Get batch details by ID including status, snapshot hashes, MPT root, and retry count. Batch statuses: NEW, PENDING_COMMITMENT, FINALIZED_COMMITMENT, ERRORED_COMMITMENT.";
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
//# sourceMappingURL=get-batch.d.ts.map