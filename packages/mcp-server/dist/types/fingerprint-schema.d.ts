import { z } from "zod";
export declare const signatureProofSchema: z.ZodObject<{
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
}>;
export declare const fingerprintValueSchema: z.ZodObject<{
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
export declare const metadataSchema: z.ZodObject<{
    hash: z.ZodOptional<z.ZodString>;
    tags: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    tags?: Record<string, string> | undefined;
    hash?: string | undefined;
}, {
    tags?: Record<string, string> | undefined;
    hash?: string | undefined;
}>;
export declare const fingerprintSubmissionSchema: z.ZodObject<{
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
}>;
//# sourceMappingURL=fingerprint-schema.d.ts.map