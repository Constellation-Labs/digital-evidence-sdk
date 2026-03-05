export type { FingerprintValue, DedSignatureProof as SignatureProofInput, FingerprintMetadata, SignedFingerprint, FingerprintSubmission, } from "@constellation-network/digital-evidence-sdk";
export interface DocumentInput {
    documentRef: string;
    contentBase64: string;
    contentType: string;
    expectedHash: string;
}
//# sourceMappingURL=fingerprint.d.ts.map