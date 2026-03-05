import { z } from "zod";
import type { DedApiClient } from "../api-client.js";
export declare const name = "ded_wait_batch_status";
export declare const description = "Wait for a batch to reach a terminal status (FINALIZED_COMMITMENT or ERRORED_COMMITMENT). Holds the connection open, polling every 3 seconds until resolved or timeout. Max wait: 60 seconds.";
export declare const inputSchema: z.ZodObject<{
    batchId: z.ZodString;
    maxWaitSeconds: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    batchId: string;
    maxWaitSeconds: number;
}, {
    batchId: string;
    maxWaitSeconds?: number | undefined;
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
//# sourceMappingURL=wait-batch-status.d.ts.map