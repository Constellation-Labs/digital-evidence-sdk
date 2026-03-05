import { z } from "zod";
import type { DedApiClient } from "../api-client.js";
export declare const name = "ded_get_latest_fingerprints";
export declare const description = "Get the most recently submitted fingerprints. Optionally filter by batch status (e.g., NEW, PENDING_COMMITMENT, FINALIZED_COMMITMENT).";
export declare const inputSchema: z.ZodObject<{
    limit: z.ZodDefault<z.ZodNumber>;
    status: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    limit: number;
    status?: string[] | undefined;
}, {
    limit?: number | undefined;
    status?: string[] | undefined;
}>;
export declare function register(client: DedApiClient): (args: z.infer<typeof inputSchema>) => Promise<{
    content: {
        type: "text";
        text: string;
    }[];
}>;
//# sourceMappingURL=get-latest.d.ts.map