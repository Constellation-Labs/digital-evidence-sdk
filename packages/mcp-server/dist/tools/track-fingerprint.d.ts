import { z } from "zod";
import type { DedApiClient } from "../api-client.js";
export declare const name = "ded_track_fingerprint";
export declare const description = "Track the lifecycle status of a fingerprint in natural language. Returns a human-friendly status string explaining where the fingerprint is in the processing pipeline.";
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
//# sourceMappingURL=track-fingerprint.d.ts.map