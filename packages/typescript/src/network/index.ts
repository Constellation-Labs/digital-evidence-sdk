/**
 * @constellation-network/digital-evidence-sdk/network
 *
 * Network module for interacting with the DED Ingestion API.
 * Import separately: `import { DedClient } from '@constellation-network/digital-evidence-sdk/network'`
 */

import { DedHttpClient } from './http-client';
import { FingerprintsApi } from './fingerprints-api';
import { BatchesApi } from './batches-api';
import type { DedClientConfig } from './types';

/**
 * Main entry point for DED API interactions.
 *
 * Provides access to fingerprint and batch endpoints through
 * a single client configured with base URL and API key.
 *
 * @example
 * ```ts
 * import { DedClient } from '@constellation-network/digital-evidence-sdk/network';
 *
 * const client = new DedClient({
 *   baseUrl: 'http://localhost:8081',
 *   apiKey: 'your-api-key',
 * });
 *
 * // Submit fingerprints
 * const results = await client.fingerprints.submit(submissions);
 *
 * // Look up by hash (public, no auth)
 * const detail = await client.fingerprints.getByHash(hash);
 *
 * // Get batch info (public)
 * const batch = await client.batches.get(batchId);
 * ```
 */
export class DedClient {
  readonly fingerprints: FingerprintsApi;
  readonly batches: BatchesApi;

  constructor(config: DedClientConfig) {
    const http = new DedHttpClient(config);
    this.fingerprints = new FingerprintsApi(http);
    this.batches = new BatchesApi(http);
  }
}

// Re-export all network types and classes
export { DedHttpClient, DedApiError } from './http-client';
export { FingerprintsApi } from './fingerprints-api';
export { BatchesApi } from './batches-api';
export type {
  DedClientConfig,
  DataResponse,
  PaginatedResponse,
  FingerprintDetail,
  FingerprintProof,
  FingerprintSearchParams,
  FingerprintStatus,
  BatchDetail,
  PlatformStats,
  DocumentUploadResultItem,
  ApiErrorResponse,
} from './types';
