import { z } from "zod";
export declare const name = "ded_hash_document";
export declare const description = "Compute the SHA-256 hash of arbitrary text content. Returns the same hash format used as documentId in fingerprint submissions.";
export declare const inputSchema: z.ZodObject<{
    content: z.ZodString;
}, "strip", z.ZodTypeAny, {
    content: string;
}, {
    content: string;
}>;
export declare function register(): (args: z.infer<typeof inputSchema>) => Promise<{
    content: {
        type: "text";
        text: string;
    }[];
}>;
//# sourceMappingURL=hash-document.d.ts.map