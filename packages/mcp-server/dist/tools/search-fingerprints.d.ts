import { z } from "zod";
import type { DedApiClient } from "../api-client.js";
export declare const name = "ded_search_fingerprints";
export declare const description = "Search fingerprints with filters. Requires an API key. Supports pagination via cursor. Returns fingerprint summaries matching the search criteria.";
export declare const inputSchema: z.ZodObject<{
    documentId: z.ZodOptional<z.ZodString>;
    eventId: z.ZodOptional<z.ZodString>;
    documentRef: z.ZodOptional<z.ZodString>;
    datetimeStart: z.ZodOptional<z.ZodString>;
    datetimeEnd: z.ZodOptional<z.ZodString>;
    tags: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    limit: z.ZodDefault<z.ZodNumber>;
    cursor: z.ZodOptional<z.ZodString>;
    forward: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    limit: number;
    forward: boolean;
    tags?: Record<string, string> | undefined;
    cursor?: string | undefined;
    eventId?: string | undefined;
    documentId?: string | undefined;
    documentRef?: string | undefined;
    datetimeStart?: string | undefined;
    datetimeEnd?: string | undefined;
}, {
    limit?: number | undefined;
    tags?: Record<string, string> | undefined;
    cursor?: string | undefined;
    forward?: boolean | undefined;
    eventId?: string | undefined;
    documentId?: string | undefined;
    documentRef?: string | undefined;
    datetimeStart?: string | undefined;
    datetimeEnd?: string | undefined;
}>;
export declare function register(client: DedApiClient): (args: z.infer<typeof inputSchema>) => Promise<{
    content: {
        type: "text";
        text: string;
    }[];
}>;
//# sourceMappingURL=search-fingerprints.d.ts.map