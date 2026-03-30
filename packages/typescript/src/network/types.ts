/**
 * Network module types — API configuration, response shapes, and search parameters.
 */

import type { X402Signer } from './x402';

/** Configuration for the DED API client */
export interface DedClientConfig {
  /** Base URL of the DED Ingestion API (e.g. "http://localhost:8081") */
  baseUrl: string;
  /** API key for authenticated endpoints (sent via X-Api-Key header) */
  apiKey?: string;
  /** x402 signer for pay-per-request authentication (alternative to apiKey) */
  signer?: X402Signer;
  /** Request timeout in milliseconds (default: 30000) */
  timeout?: number;
}

/** Standard wrapped response from the API */
export interface DataResponse<T> {
  data: T;
}

/** Paginated response with cursor-based navigation */
export interface PaginatedResponse<T> {
  data: T;
  pagination: {
    cursor?: string;
    hasMore: boolean;
  };
}

/** Detailed fingerprint info returned from search/lookup endpoints */
export interface FingerprintDetail {
  eventId: string;
  documentId: string;
  documentRef: string;
  hash: string;
  createdAt: string;
  batchId?: string;
  tags?: Record<string, string>;
}

/** Merkle proof for a finalized fingerprint */
export interface FingerprintProof {
  hash: string;
  proof: {
    batchId: string;
    batchRoot: string;
    signature: string;
    proofPath: string[];
    proofIndices: number[];
    treeHeight: number;
  };
}

/** Batch detail */
export interface BatchDetail {
  batchId: string;
  status: string;
  batchRoot?: string;
  fingerprintCount: number;
  createdAt: string;
  finalizedAt?: string;
}

/** Platform-wide statistics */
export interface PlatformStats {
  totalFingerprints: number;
  totalBatches: number;
  totalFinalized: number;
}

/** Fingerprint status for filtering */
export type FingerprintStatus =
  | 'UNASSIGNED'
  | 'ASSIGNED'
  | 'FINALIZED_COMMITMENT'
  | 'ERRORED_COMMITMENT';

/** Search query parameters for GET /v1/fingerprints */
export interface FingerprintSearchParams {
  documentId?: string;
  eventId?: string;
  documentRef?: string;
  datetimeStart?: string;
  datetimeEnd?: string;
  cursor?: string;
  limit?: number;
  tags?: Record<string, string>;
  forward?: boolean;
}

/** Result item from document upload */
export interface DocumentUploadResultItem {
  eventId: string;
  hash: string;
  accepted: boolean;
  document?: {
    s3Key: string;
    contentType: string;
    fileSize: number;
    uploadedAt: string;
  };
  errors: string[];
}

/** API error response shape */
export interface ApiErrorResponse {
  errors?: Array<{ message: string }>;
  message?: string;
}
