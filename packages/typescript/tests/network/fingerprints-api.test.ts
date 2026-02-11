import { DedClient, DedApiError } from '../../src/network/index';
import type { FingerprintSubmission } from '../../src/core/types';

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

const client = new DedClient({
  baseUrl: 'http://localhost:8081',
  apiKey: 'test-api-key',
});

const validSubmission: FingerprintSubmission = {
  attestation: {
    content: {
      orgId: '550e8400-e29b-41d4-a716-446655440000',
      tenantId: '123e4567-e89b-12d3-a456-426614174000',
      eventId: '7ca8c920-0ead-22e2-91c5-11d05fe540d9',
      documentId: 'doc-001',
      documentRef: 'a'.repeat(64),
      timestamp: '2024-01-15T10:30:00.000Z',
      version: 1,
    },
    proofs: [
      {
        id: 'b'.repeat(128),
        signature: 'c'.repeat(128),
        algorithm: 'SECP256K1_RFC8785_V1',
      },
    ],
  },
};

beforeEach(() => {
  mockFetch.mockReset();
});

describe('FingerprintsApi', () => {
  describe('submit', () => {
    it('should POST to /v1/fingerprints with API key', async () => {
      const responseData = [
        { eventId: 'abc', hash: 'def', accepted: true, errors: [] },
      ];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(responseData),
      });

      const result = await client.fingerprints.submit([validSubmission]);

      expect(result).toEqual(responseData);
      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe('http://localhost:8081/v1/fingerprints');
      expect(options.method).toBe('POST');
      expect(options.headers['X-Api-Key']).toBe('test-api-key');
      expect(options.headers['Content-Type']).toBe('application/json');
    });

    it('should throw DedApiError on non-ok response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 402,
        statusText: 'Payment Required',
        json: () =>
          Promise.resolve({ message: 'Insufficient credits' }),
      });

      await expect(
        client.fingerprints.submit([validSubmission])
      ).rejects.toThrow(DedApiError);
    });
  });

  describe('submitInBatches', () => {
    it('should split submissions into batches', async () => {
      const submissions = Array(25).fill(validSubmission);
      const singleResult = {
        eventId: 'abc',
        hash: 'def',
        accepted: true,
        errors: [],
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve(
            Array(10)
              .fill(null)
              .map(() => singleResult)
          ),
      });

      const results = await client.fingerprints.submitInBatches(
        submissions,
        10,
        0 // no delay for tests
      );

      // 25 items / 10 per batch = 3 calls
      expect(mockFetch).toHaveBeenCalledTimes(3);
      expect(results).toHaveLength(30); // 10 + 10 + 10 (mock returns 10 each)
    });
  });

  describe('validate', () => {
    it('should POST to /v1/fingerprints/validate', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve([
            { eventId: 'abc', hash: 'def', accepted: true, errors: [] },
          ]),
      });

      await client.fingerprints.validate([validSubmission]);

      const [url] = mockFetch.mock.calls[0];
      expect(url).toBe('http://localhost:8081/v1/fingerprints/validate');
    });
  });

  describe('search', () => {
    it('should GET /v1/fingerprints with query params', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: [],
            pagination: { hasMore: false },
          }),
      });

      await client.fingerprints.search({
        documentId: 'doc-001',
        limit: 5,
        tags: { dept: 'legal' },
      });

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain('/v1/fingerprints');
      expect(url).toContain('document_id=doc-001');
      expect(url).toContain('limit=5');
      expect(url).toContain('tags=');
      expect(options.headers['X-Api-Key']).toBe('test-api-key');
    });
  });

  describe('getByHash (public)', () => {
    it('should GET /v1/fingerprints/{hash} without API key', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: { eventId: 'abc', hash: 'def' },
          }),
      });

      await client.fingerprints.getByHash('abc123');

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe('http://localhost:8081/v1/fingerprints/abc123');
      expect(options.headers['X-Api-Key']).toBeUndefined();
    });
  });

  describe('getProof (public)', () => {
    it('should GET /v1/fingerprints/{hash}/proof', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: { hash: 'abc', proof: {} } }),
      });

      await client.fingerprints.getProof('abc123');

      const [url] = mockFetch.mock.calls[0];
      expect(url).toBe('http://localhost:8081/v1/fingerprints/abc123/proof');
    });
  });

  describe('getLatest (public)', () => {
    it('should GET /v1/fingerprints/latest with params', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: [] }),
      });

      await client.fingerprints.getLatest(20, 'FINALIZED_COMMITMENT');

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain('limit=20');
      expect(url).toContain('status=FINALIZED_COMMITMENT');
    });
  });

  describe('getStats (public)', () => {
    it('should GET /v1/fingerprints/stats', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: {
              totalFingerprints: 100,
              totalBatches: 10,
              totalFinalized: 5,
            },
          }),
      });

      const result = await client.fingerprints.getStats();

      expect(result.data.totalFingerprints).toBe(100);
    });
  });
});

describe('BatchesApi', () => {
  describe('get', () => {
    it('should GET /v1/batches/{batchId} (public)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: { batchId: 'abc' } }),
      });

      await client.batches.get('abc-uuid');

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe('http://localhost:8081/v1/batches/abc-uuid');
      expect(options.headers['X-Api-Key']).toBeUndefined();
    });
  });

  describe('getFingerprints', () => {
    it('should GET /v1/batches/{batchId}/fingerprints (public)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: [] }),
      });

      await client.batches.getFingerprints('abc-uuid');

      const [url] = mockFetch.mock.calls[0];
      expect(url).toBe(
        'http://localhost:8081/v1/batches/abc-uuid/fingerprints'
      );
    });
  });
});
