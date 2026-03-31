/**
 * x402 fingerprint API client — same surface as the base SDK minus validate().
 */
import type { FingerprintSubmission } from '@constellation-network/digital-evidence-sdk';
import type { FingerprintDetail, FingerprintProof, FingerprintSearchParams, FingerprintStatus, PlatformStats, DataResponse, PaginatedResponse, DocumentUploadResultItem } from '@constellation-network/digital-evidence-sdk/network';
import { X402HttpClient } from './x402-http-client';
import type { PaymentOr } from './types';
/**
 * Fingerprint API client with x402 payment flow.
 *
 * Authenticated endpoints (submit, upload, search) handle the 402 payment
 * challenge automatically when autoPay=true, or return PaymentRequiredResult
 * for caller-driven payment when autoPay=false.
 *
 * Public endpoints (getByHash, getProof, getLatest, getStats) work
 * without any authentication, identical to the base SDK.
 */
export declare class X402FingerprintsApi {
    private readonly http;
    constructor(http: X402HttpClient);
    /** Submit fingerprints for notarization (x402 payment). */
    submit(submissions: FingerprintSubmission[]): Promise<PaymentOr<FingerprintSubmission[]>>;
    /** Submit fingerprints in batches (each batch is a separate x402 payment). */
    submitInBatches(submissions: FingerprintSubmission[], batchSize?: number, delayMs?: number): Promise<PaymentOr<FingerprintSubmission[]>[]>;
    /** Upload fingerprints with documents (x402 payment, multipart). */
    upload(submissions: FingerprintSubmission[], documents: Map<string, {
        blob: Blob;
        mimeType: string;
    }>): Promise<PaymentOr<DataResponse<DocumentUploadResultItem[]>>>;
    /** Search fingerprints with filtering and pagination (x402 payment). */
    search(params: FingerprintSearchParams): Promise<PaymentOr<PaginatedResponse<FingerprintDetail[]>>>;
    /** Get fingerprint detail by its hash (public). */
    getByHash(hash: string): Promise<DataResponse<FingerprintDetail>>;
    /** Get Merkle inclusion proof for a finalized fingerprint (public). */
    getProof(hash: string): Promise<DataResponse<FingerprintProof>>;
    /** Get latest fingerprints (public). */
    getLatest(limit?: number, status?: FingerprintStatus): Promise<DataResponse<FingerprintDetail[]>>;
    /** Get platform-wide statistics (public). */
    getStats(): Promise<DataResponse<PlatformStats>>;
}
