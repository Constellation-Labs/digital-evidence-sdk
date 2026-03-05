import { z } from "zod";
import type { DedApiClient } from "../api-client.js";
export declare const name = "ded_get_stats";
export declare const description = "Get platform-wide fingerprint statistics including counts for the last 24 hours, 30 days, and all time.";
export declare const inputSchema: z.ZodObject<{}, "strip", z.ZodTypeAny, {}, {}>;
export declare function register(client: DedApiClient): (_args: z.infer<typeof inputSchema>) => Promise<{
    content: {
        type: "text";
        text: string;
    }[];
}>;
//# sourceMappingURL=get-stats.d.ts.map