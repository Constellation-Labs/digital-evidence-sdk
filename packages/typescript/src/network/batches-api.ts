import { DedHttpClient } from './http-client';
import type { DataResponse, BatchDetail, FingerprintDetail } from './types';

/**
 * API client for batch endpoints (all public, no API key required).
 */
export class BatchesApi {
  constructor(private readonly http: DedHttpClient) {}

  /**
   * Get batch details by ID.
   *
   * @param batchId - UUID of the batch
   * @returns Batch detail including status and fingerprint count
   */
  async get(batchId: string): Promise<DataResponse<BatchDetail>> {
    return this.http.getPublic<DataResponse<BatchDetail>>(`/v1/batches/${batchId}`);
  }

  /**
   * Get all fingerprints in a batch.
   *
   * @param batchId - UUID of the batch
   * @returns List of fingerprint details belonging to this batch
   */
  async getFingerprints(batchId: string): Promise<DataResponse<FingerprintDetail[]>> {
    return this.http.getPublic<DataResponse<FingerprintDetail[]>>(
      `/v1/batches/${batchId}/fingerprints`
    );
  }
}
