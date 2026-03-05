import { z } from "zod";
export declare const name = "ded_prepare_fingerprint";
export declare const description = "Hash, sign, and assemble a complete FingerprintSubmission from raw document content in one step. Requires DED_SIGNING_PRIVATE_KEY to be configured. Returns a ready-to-submit FingerprintSubmission JSON. IMPORTANT: Pass the returned JSON to ded_submit_fingerprints exactly as-is \u2014 do NOT add, remove, or modify any fields, as this will invalidate the cryptographic signature. Prefer ded_notarize instead, which prepares and submits in a single step.";
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
export declare function register(privateKey: string): (args: z.infer<typeof inputSchema>) => Promise<{
    content: {
        type: "text";
        text: string;
    }[];
}>;
//# sourceMappingURL=prepare-fingerprint.d.ts.map