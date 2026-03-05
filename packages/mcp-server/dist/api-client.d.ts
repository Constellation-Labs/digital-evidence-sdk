import type { Config } from "./config.js";
import type { PaginatedDataResponse, FingerprintDetails, FingerprintSummary, FingerprintGlobalStats, BatchInfo, MerklePatriciaInclusionProof, FingerprintSubmissionResult, DocumentUploadResponse, DocumentDownloadResult } from "./types/api.js";
import type { FingerprintSubmission, DocumentInput } from "./types/fingerprint.js";
export declare class DedApiClient {
    private baseUrl;
    private apiKey?;
    constructor(config: Config);
    private request;
    getStats(): Promise<FingerprintGlobalStats>;
    getLatest(limit?: number, status?: string[]): Promise<FingerprintSummary[]>;
    getFingerprint(hash: string): Promise<FingerprintDetails | null>;
    getFingerprintProof(hash: string): Promise<MerklePatriciaInclusionProof>;
    getBatch(batchId: string): Promise<BatchInfo | null>;
    getBatchFingerprints(batchId: string): Promise<FingerprintSummary[] | null>;
    searchFingerprints(params: {
        documentId?: string;
        eventId?: string;
        documentRef?: string;
        datetimeStart?: string;
        datetimeEnd?: string;
        tags?: Record<string, string>;
        limit?: number;
        cursor?: string;
        forward?: boolean;
    }): Promise<PaginatedDataResponse<FingerprintSummary[]>>;
    submitFingerprints(submissions: FingerprintSubmission[]): Promise<FingerprintSubmissionResult[]>;
    validateFingerprints(submissions: FingerprintSubmission[]): Promise<unknown>;
    downloadDocument(eventId: string): Promise<DocumentDownloadResult | null>;
    uploadDocuments(fingerprints: FingerprintSubmission[], documents: DocumentInput[]): Promise<DocumentUploadResponse>;
}
//# sourceMappingURL=api-client.d.ts.map