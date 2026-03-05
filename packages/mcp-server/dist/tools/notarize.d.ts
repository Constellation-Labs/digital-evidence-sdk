import { z } from "zod";
import type { DedApiClient } from "../api-client.js";
export declare const name = "ded_notarize";
export declare const description = "All-in-one notarization: hashes the content, builds a FingerprintSubmission, signs it, computes the metadata hash, and submits it to the DED API. Returns the submission result. Requires both DED_SIGNING_PRIVATE_KEY and DED_API_KEY.";
export declare const inputSchema: z.ZodObject<{
    content: z.ZodString;
    orgId: z.ZodString;
    tenantId: z.ZodString;
    documentRef: z.ZodString;
    tags: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    documentRef: string;
    orgId: string;
    tenantId: string;
    content: string;
    tags?: Record<string, string> | undefined;
}, {
    documentRef: string;
    orgId: string;
    tenantId: string;
    content: string;
    tags?: Record<string, string> | undefined;
}>;
export declare function register(privateKey: string, client: DedApiClient): (args: z.infer<typeof inputSchema>) => Promise<{
    content: {
        type: "text";
        text: string;
    }[];
}>;
//# sourceMappingURL=notarize.d.ts.map