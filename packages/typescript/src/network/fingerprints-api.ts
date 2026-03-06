import type { FingerprintSubmission, FingerprintSubmissionResult } from '../core/types';
import { DedHttpClient } from './http-client';
import type {
  DataResponse,
  PaginatedResponse,
  FingerprintDetail,
  FingerprintProof,
  FingerprintSearchParams,
  FingerprintStatus,
  PlatformStats,
  DocumentUploadResultItem,
} from './types';

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/json',
  'application/xml',
  'text/csv',
]);

/**
 * API client for fingerprint endpoints.
 *
 * Authenticated endpoints require an API key (configured in DedClientConfig).
 * Public endpoints work without authentication.
 */
export class FingerprintsApi {
  constructor(private readonly http: DedHttpClient) {}

  // ─── Authenticated endpoints ───────────────────────────────────

  /**
   * Submit fingerprints for notarization.
   *
   * @param submissions - Array of FingerprintSubmission objects
   * @returns Array of results indicating acceptance/rejection per submission
   */
  async submit(submissions: FingerprintSubmission[]): Promise<FingerprintSubmissionResult[]> {
    return this.http.post<FingerprintSubmissionResult[]>('/v1/fingerprints', submissions);
  }

  /**
   * Submit fingerprints in batches to avoid overwhelming the API.
   *
   * @param submissions - All submissions to send
   * @param batchSize - Number of submissions per API call (default: 10)
   * @param delayMs - Delay between batches in ms (default: 1000)
   * @returns Combined results from all batches
   */
  async submitInBatches(
    submissions: FingerprintSubmission[],
    batchSize = 10,
    delayMs = 1000
  ): Promise<FingerprintSubmissionResult[]> {
    const results: FingerprintSubmissionResult[] = [];

    for (let i = 0; i < submissions.length; i += batchSize) {
      const batch = submissions.slice(i, i + batchSize);
      const batchResults = await this.submit(batch);
      results.push(...batchResults);

      // Delay between batches (skip after last batch)
      if (i + batchSize < submissions.length && delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }

    return results;
  }

  /**
   * Validate fingerprints without storing them (no credits consumed).
   *
   * @param submissions - Array of FingerprintSubmission objects to validate
   * @returns Array of validation results
   */
  async validate(submissions: FingerprintSubmission[]): Promise<FingerprintSubmissionResult[]> {
    return this.http.post<FingerprintSubmissionResult[]>('/v1/fingerprints/validate', submissions);
  }

  /**
   * Upload fingerprints with associated documents (multipart).
   *
   * @param submissions - Fingerprint submissions
   * @param documents - Map of documentRef to File/Blob
   * @returns Upload results for each submission
   */
  async upload(
    submissions: FingerprintSubmission[],
    documents: Map<string, { blob: Blob; mimeType: string }>
  ): Promise<DocumentUploadResultItem[]> {
    const formData = new FormData();
    formData.append(
      'fingerprints',
      new Blob([JSON.stringify(submissions)], { type: 'application/json' })
    );

    for (const [documentRef, { blob, mimeType }] of documents) {
      if (!ALLOWED_MIME_TYPES.has(mimeType)) {
        throw new Error(
          `Unsupported mime type "${mimeType}" for document "${documentRef}". Allowed: ${[...ALLOWED_MIME_TYPES].join(', ')}`
        );
      }
      formData.append(documentRef, new Blob([blob], { type: mimeType }), documentRef);
    }

    return this.http.postMultipart<DocumentUploadResultItem[]>('/v1/fingerprints/upload', formData);
  }

  /**
   * Search fingerprints with filtering and pagination.
   *
   * @param params - Search query parameters
   * @returns Paginated list of fingerprint details
   */
  async search(params: FingerprintSearchParams): Promise<PaginatedResponse<FingerprintDetail[]>> {
    const query: Record<string, string> = {};

    if (params.documentId) query['document_id'] = params.documentId;
    if (params.eventId) query['event_id'] = params.eventId;
    if (params.documentRef) query['document_ref'] = params.documentRef;
    if (params.datetimeStart) query['datetime_start'] = params.datetimeStart;
    if (params.datetimeEnd) query['datetime_end'] = params.datetimeEnd;
    if (params.cursor) query['cursor'] = params.cursor;
    if (params.limit !== undefined) query['limit'] = String(params.limit);
    if (params.forward !== undefined) query['forward'] = String(params.forward);
    if (params.tags) query['tags'] = JSON.stringify(params.tags);

    return this.http.get<PaginatedResponse<FingerprintDetail[]>>('/v1/fingerprints', query);
  }

  // ─── Public endpoints (no API key required) ────────────────────

  /**
   * Get fingerprint detail by its hash.
   *
   * @param hash - Hex-encoded SHA-256 hash (64 characters)
   * @returns Fingerprint detail
   */
  async getByHash(hash: string): Promise<DataResponse<FingerprintDetail>> {
    return this.http.getPublic<DataResponse<FingerprintDetail>>(`/v1/fingerprints/${hash}`);
  }

  /**
   * Get the Merkle inclusion proof for a finalized fingerprint.
   *
   * @param hash - Hex-encoded SHA-256 hash (64 characters)
   * @returns Proof data including batch root, path, and indices
   */
  async getProof(hash: string): Promise<DataResponse<FingerprintProof>> {
    return this.http.getPublic<DataResponse<FingerprintProof>>(`/v1/fingerprints/${hash}/proof`);
  }

  /**
   * Get the latest fingerprints, optionally filtered by status.
   *
   * @param limit - Number of fingerprints to return (1-500, default: 10)
   * @param status - Optional status filter
   * @returns List of fingerprint details
   */
  async getLatest(
    limit?: number,
    status?: FingerprintStatus
  ): Promise<DataResponse<FingerprintDetail[]>> {
    const query: Record<string, string> = {};
    if (limit !== undefined) query['limit'] = String(limit);
    if (status) query['status'] = status;

    return this.http.getPublic<DataResponse<FingerprintDetail[]>>('/v1/fingerprints/latest', query);
  }

  /**
   * Get platform-wide statistics.
   *
   * @returns Statistics including total fingerprints, batches, and finalized count
   */
  async getStats(): Promise<DataResponse<PlatformStats>> {
    return this.http.getPublic<DataResponse<PlatformStats>>('/v1/fingerprints/stats');
  }
}
