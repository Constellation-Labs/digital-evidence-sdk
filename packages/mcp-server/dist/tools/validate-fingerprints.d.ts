import { z } from "zod";
import type { DedApiClient } from "../api-client.js";
export declare const name = "ded_validate_fingerprints";
export declare const description = "Dry-run validation of fingerprint submissions without actually submitting them. Requires an API key. Use this to check that fingerprints are correctly formatted before submission.";
export declare const inputSchema: z.ZodObject<{
    fingerprints: z.ZodArray<z.ZodObject<{
        attestation: z.ZodObject<{
            content: z.ZodObject<{
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
            proofs: z.ZodArray<z.ZodObject<{
                id: z.ZodString;
                signature: z.ZodString;
                algorithm: z.ZodEnum<["SECP256K1_RFC8785_V1"]>;
            }, "strip", z.ZodTypeAny, {
                id: string;
                signature: string;
                algorithm: "SECP256K1_RFC8785_V1";
            }, {
                id: string;
                signature: string;
                algorithm: "SECP256K1_RFC8785_V1";
            }>, "many">;
        }, "strip", z.ZodTypeAny, {
            content: {
                eventId: string;
                documentId: string;
                documentRef: string;
                orgId: string;
                tenantId: string;
                timestamp: string;
                version: number;
                signerId?: string | undefined;
            };
            proofs: {
                id: string;
                signature: string;
                algorithm: "SECP256K1_RFC8785_V1";
            }[];
        }, {
            content: {
                eventId: string;
                documentId: string;
                documentRef: string;
                orgId: string;
                tenantId: string;
                timestamp: string;
                version: number;
                signerId?: string | undefined;
            };
            proofs: {
                id: string;
                signature: string;
                algorithm: "SECP256K1_RFC8785_V1";
            }[];
        }>;
        metadata: z.ZodOptional<z.ZodObject<{
            hash: z.ZodOptional<z.ZodString>;
            tags: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
        }, "strip", z.ZodTypeAny, {
            tags?: Record<string, string> | undefined;
            hash?: string | undefined;
        }, {
            tags?: Record<string, string> | undefined;
            hash?: string | undefined;
        }>>;
    }, "strip", z.ZodTypeAny, {
        attestation: {
            content: {
                eventId: string;
                documentId: string;
                documentRef: string;
                orgId: string;
                tenantId: string;
                timestamp: string;
                version: number;
                signerId?: string | undefined;
            };
            proofs: {
                id: string;
                signature: string;
                algorithm: "SECP256K1_RFC8785_V1";
            }[];
        };
        metadata?: {
            tags?: Record<string, string> | undefined;
            hash?: string | undefined;
        } | undefined;
    }, {
        attestation: {
            content: {
                eventId: string;
                documentId: string;
                documentRef: string;
                orgId: string;
                tenantId: string;
                timestamp: string;
                version: number;
                signerId?: string | undefined;
            };
            proofs: {
                id: string;
                signature: string;
                algorithm: "SECP256K1_RFC8785_V1";
            }[];
        };
        metadata?: {
            tags?: Record<string, string> | undefined;
            hash?: string | undefined;
        } | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    fingerprints: {
        attestation: {
            content: {
                eventId: string;
                documentId: string;
                documentRef: string;
                orgId: string;
                tenantId: string;
                timestamp: string;
                version: number;
                signerId?: string | undefined;
            };
            proofs: {
                id: string;
                signature: string;
                algorithm: "SECP256K1_RFC8785_V1";
            }[];
        };
        metadata?: {
            tags?: Record<string, string> | undefined;
            hash?: string | undefined;
        } | undefined;
    }[];
}, {
    fingerprints: {
        attestation: {
            content: {
                eventId: string;
                documentId: string;
                documentRef: string;
                orgId: string;
                tenantId: string;
                timestamp: string;
                version: number;
                signerId?: string | undefined;
            };
            proofs: {
                id: string;
                signature: string;
                algorithm: "SECP256K1_RFC8785_V1";
            }[];
        };
        metadata?: {
            tags?: Record<string, string> | undefined;
            hash?: string | undefined;
        } | undefined;
    }[];
}>;
export declare function register(client: DedApiClient): (args: z.infer<typeof inputSchema>) => Promise<{
    content: {
        type: "text";
        text: string;
    }[];
}>;
//# sourceMappingURL=validate-fingerprints.d.ts.map