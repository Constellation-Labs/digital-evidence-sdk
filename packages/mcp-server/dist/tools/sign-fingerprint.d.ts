import { z } from "zod";
export declare const name = "ded_sign_fingerprint";
export declare const description = "Sign a FingerprintValue using the SECP256K1_RFC8785_V1 protocol (RFC 8785 canonical JSON + SECP256K1). Requires DED_SIGNING_PRIVATE_KEY to be configured. Returns a SignatureProof that can be used with ded_submit_fingerprints.";
export declare const inputSchema: z.ZodObject<{
    fingerprintValue: z.ZodObject<{
        orgId: z.ZodString;
        tenantId: z.ZodString;
        eventId: z.ZodString;
        signerId: z.ZodOptional<z.ZodString>;
        documentId: z.ZodString;
        documentRef: z.ZodString;
        timestamp: z.ZodString;
        version: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        eventId: string;
        documentId: string;
        documentRef: string;
        orgId: string;
        tenantId: string;
        timestamp: string;
        version: number;
        signerId?: string | undefined;
    }, {
        eventId: string;
        documentId: string;
        documentRef: string;
        orgId: string;
        tenantId: string;
        timestamp: string;
        version: number;
        signerId?: string | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    fingerprintValue: {
        eventId: string;
        documentId: string;
        documentRef: string;
        orgId: string;
        tenantId: string;
        timestamp: string;
        version: number;
        signerId?: string | undefined;
    };
}, {
    fingerprintValue: {
        eventId: string;
        documentId: string;
        documentRef: string;
        orgId: string;
        tenantId: string;
        timestamp: string;
        version: number;
        signerId?: string | undefined;
    };
}>;
export declare function register(privateKey: string): (args: z.infer<typeof inputSchema>) => Promise<{
    content: {
        type: "text";
        text: string;
    }[];
}>;
//# sourceMappingURL=sign-fingerprint.d.ts.map