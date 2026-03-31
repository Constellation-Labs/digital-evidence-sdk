/**
 * x402 fingerprint API client — same surface as the base SDK minus validate().
 */

import type { FingerprintSubmission } from '@constellation-network/digital-evidence-sdk';
import type {
  FingerprintDetail,
  FingerprintProof,
  FingerprintSearchParams,
  FingerprintStatus,
  PlatformStats,
  DataResponse,
  PaginatedResponse,
  DocumentUploadResultItem,
} from '@constellation-network/digital-evidence-sdk/network';

import { X402HttpClient } from './x402-http-client';
import type { PaymentOr } from './types';

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
 * Fingerprint API client with x402 payment flow.
 *
 * Authenticated endpoints (submit, upload, search) handle the 402 payment
 * challenge automatically when autoPay=true, or return PaymentRequiredResult
 * for caller-driven payment when autoPay=false.
 *
 * Public endpoints (getByHash, getProof, getLatest, getStats) work
 * without any authentication, identical to the base SDK.
 */
export class X402FingerprintsApi {
  constructor(private readonly http: X402HttpClient) {}

  // ─── Paid endpoints (x402) ──────────────────────────────────

  /** Submit fingerprints for notarization (x402 payment). */
  async submit(
    submissions: FingerprintSubmission[]
  ): Promise<PaymentOr<FingerprintSubmission[]>> {
    return this.http.postWithPayment('/v1/fingerprints', submissions);
  }

  /** Submit fingerprints in batches (each batch is a separate x402 payment). */
  async submitInBatches(
    submissions: FingerprintSubmission[],
    batchSize = 10,
    delayMs = 1000
  ): Promise<PaymentOr<FingerprintSubmission[]>[]> {
    const results: PaymentOr<FingerprintSubmission[]>[] = [];

    for (let i = 0; i < submissions.length; i += batchSize) {
      const batch = submissions.slice(i, i + batchSize);
      const batchResult = await this.submit(batch);
      results.push(batchResult);

      if (i + batchSize < submissions.length && delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }

    return results;
  }

  /** Upload fingerprints with documents (x402 payment, multipart). */
  async upload(
    submissions: FingerprintSubmission[],
    documents: Map<string, { blob: Blob; mimeType: string }>
  ): Promise<PaymentOr<DataResponse<DocumentUploadResultItem[]>>> {
    for (const [documentRef, { mimeType }] of documents) {
      if (!ALLOWED_MIME_TYPES.has(mimeType)) {
        throw new Error(
          `Unsupported mime type "${mimeType}" for document "${documentRef}". Allowed: ${[...ALLOWED_MIME_TYPES].join(', ')}`
        );
      }
    }

    const boundary =
      '----DedX402Sdk' + Math.random().toString(36).slice(2) + Date.now().toString(36);
    const parts: Uint8Array[] = [];
    const encoder = new TextEncoder();

    // Fingerprints JSON part
    const fingerprintsJson = JSON.stringify(submissions);
    const fingerprintsBytes = encoder.encode(fingerprintsJson);
    parts.push(
      encoder.encode(
        `--${boundary}\r\n` +
          `Content-Disposition: form-data; name="fingerprints"\r\n` +
          `Content-Type: application/json\r\n` +
          `Content-Length: ${fingerprintsBytes.byteLength}\r\n` +
          `\r\n`
      ),
      fingerprintsBytes,
      encoder.encode('\r\n')
    );

    // Document parts
    for (const [documentRef, { blob, mimeType }] of documents) {
      const docBytes = new Uint8Array(await blob.arrayBuffer());
      parts.push(
        encoder.encode(
          `--${boundary}\r\n` +
            `Content-Disposition: form-data; name="${documentRef}"; filename="${documentRef}"\r\n` +
            `Content-Type: ${mimeType}\r\n` +
            `Content-Length: ${docBytes.byteLength}\r\n` +
            `\r\n`
        ),
        docBytes,
        encoder.encode('\r\n')
      );
    }

    // Final boundary
    parts.push(encoder.encode(`--${boundary}--\r\n`));

    // Concatenate all parts
    const totalLength = parts.reduce((sum, p) => sum + p.byteLength, 0);
    const body = new Uint8Array(totalLength);
    let offset = 0;
    for (const part of parts) {
      body.set(part, offset);
      offset += part.byteLength;
    }

    return this.http.postMultipartWithPayment(
      '/v1/fingerprints/upload',
      body,
      `multipart/form-data; boundary=${boundary}`
    );
  }

  /** Search fingerprints with filtering and pagination (x402 payment). */
  async search(
    params: FingerprintSearchParams
  ): Promise<PaymentOr<PaginatedResponse<FingerprintDetail[]>>> {
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

    return this.http.getWithPayment('/v1/fingerprints', query);
  }

  // ─── Public endpoints (no auth required) ────────────────────

  /** Get fingerprint detail by its hash (public). */
  async getByHash(hash: string): Promise<DataResponse<FingerprintDetail>> {
    return this.http.getPublic(`/v1/fingerprints/${hash}`);
  }

  /** Get Merkle inclusion proof for a finalized fingerprint (public). */
  async getProof(hash: string): Promise<DataResponse<FingerprintProof>> {
    return this.http.getPublic(`/v1/fingerprints/${hash}/proof`);
  }

  /** Get latest fingerprints (public). */
  async getLatest(
    limit?: number,
    status?: FingerprintStatus
  ): Promise<DataResponse<FingerprintDetail[]>> {
    const query: Record<string, string> = {};
    if (limit !== undefined) query['limit'] = String(limit);
    if (status) query['status'] = status;
    return this.http.getPublic('/v1/fingerprints/latest', query);
  }

  /** Get platform-wide statistics (public). */
  async getStats(): Promise<DataResponse<PlatformStats>> {
    return this.http.getPublic('/v1/fingerprints/stats');
  }
}
