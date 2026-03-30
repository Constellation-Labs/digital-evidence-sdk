import {
  DedClient,
  DedApiError,
  createEthersSigner,
  parsePaymentRequired,
  buildPaymentHeader,
} from '../../src/network/index';
import type { X402Signer, X402PaymentOffer } from '../../src/network/index';
import type { FingerprintSubmission } from '../../src/core/types';

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock crypto.getRandomValues for deterministic tests
const originalGetRandomValues = crypto.getRandomValues;
beforeAll(() => {
  crypto.getRandomValues = ((array: Uint8Array) => {
    for (let i = 0; i < array.length; i++) array[i] = i;
    return array;
  }) as typeof crypto.getRandomValues;
});
afterAll(() => {
  crypto.getRandomValues = originalGetRandomValues;
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

const mockPaymentOffer: X402PaymentOffer = {
  scheme: 'exact',
  network: 'eip155:84532',
  amount: '20000',
  asset: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
  payTo: '0x1234567890abcdef1234567890abcdef12345678',
  maxTimeoutSeconds: 60,
  extra: { name: 'USD Coin', version: '2' },
};

const mock402Body = {
  x402Version: 1,
  resource: { url: '/v1/fingerprints', description: 'Submit fingerprints' },
  accepts: [mockPaymentOffer],
};

const mockSigner: X402Signer = {
  address: '0xAbCdEf1234567890AbCdEf1234567890AbCdEf12',
  async signTypedData(_domain, _types, _value) {
    return '0x' + 'ab'.repeat(65);
  },
};

beforeEach(() => {
  mockFetch.mockReset();
});

describe('parsePaymentRequired', () => {
  it('should parse 402 JSON body with accepts array', async () => {
    const response = new Response(JSON.stringify(mock402Body), { status: 402 });
    const result = await parsePaymentRequired(response);
    expect(result).toBeDefined();
    expect(result!.accepts).toHaveLength(1);
    expect(result!.accepts[0].amount).toBe('20000');
  });

  it('should fallback to X-PAYMENT-REQUIRED header', async () => {
    const headerValue = btoa(JSON.stringify(mock402Body));
    const response = new Response('not json', {
      status: 402,
      headers: { 'X-PAYMENT-REQUIRED': headerValue },
    });
    const result = await parsePaymentRequired(response);
    expect(result).toBeDefined();
    expect(result!.accepts[0].network).toBe('eip155:84532');
  });

  it('should return null when no payment info available', async () => {
    const response = new Response('not json', { status: 402 });
    const result = await parsePaymentRequired(response);
    expect(result).toBeNull();
  });
});

describe('buildPaymentHeader', () => {
  it('should produce a valid base64-encoded payment payload', async () => {
    const header = await buildPaymentHeader(mockPaymentOffer, mockSigner);
    const decoded = JSON.parse(atob(header));

    expect(decoded.x402Version).toBe(2);
    expect(decoded.accepted.network).toBe('eip155:84532');
    expect(decoded.accepted.amount).toBe('20000');
    expect(decoded.accepted.asset).toBe(mockPaymentOffer.asset);
    expect(decoded.accepted.payTo).toBe(mockPaymentOffer.payTo);
    expect(decoded.payload.signature).toBe('0x' + 'ab'.repeat(65));
    expect(decoded.payload.authorization.from).toBe(mockSigner.address);
    expect(decoded.payload.authorization.to).toBe(mockPaymentOffer.payTo);
    expect(decoded.payload.authorization.value).toBe('20000');
    expect(decoded.payload.authorization.validAfter).toBe('0');
  });

  it('should use defaults when extra is missing', async () => {
    const offerNoExtra = { ...mockPaymentOffer, extra: undefined };
    const header = await buildPaymentHeader(offerNoExtra, mockSigner);
    const decoded = JSON.parse(atob(header));

    expect(decoded.accepted.extra).toEqual({});
  });
});

describe('createEthersSigner', () => {
  it('should delegate address and signTypedData to the wallet', async () => {
    const mockWallet = {
      address: '0x1111111111111111111111111111111111111111',
      signTypedData: jest.fn().mockResolvedValue('0xsig'),
    };

    const signer = createEthersSigner(mockWallet);

    expect(signer.address).toBe(mockWallet.address);

    const domain = { name: 'Test', version: '1', chainId: 1, verifyingContract: '0x0' };
    const types = { Test: [{ name: 'value', type: 'uint256' }] };
    const value = { value: '123' };

    const sig = await signer.signTypedData(domain, types, value);
    expect(sig).toBe('0xsig');
    expect(mockWallet.signTypedData).toHaveBeenCalledTimes(1);
  });
});

describe('DedHttpClient x402 integration', () => {
  it('should handle 402 → sign → retry for submit', async () => {
    const client = new DedClient({
      baseUrl: 'http://localhost:8081',
      signer: mockSigner,
    });

    const responseData = [{ eventId: 'abc', hash: 'def', accepted: true, errors: [] }];

    // First call: 402 with payment info
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 402,
      clone: () => ({
        json: () => Promise.resolve(mock402Body),
      }),
      headers: new Headers(),
    });

    // Second call: success
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve(responseData),
    });

    const result = await client.fingerprints.submit([validSubmission]);

    expect(result).toEqual(responseData);
    expect(mockFetch).toHaveBeenCalledTimes(2);

    // First request: no auth headers
    const [, firstOpts] = mockFetch.mock.calls[0];
    expect(firstOpts.headers['X-Api-Key']).toBeUndefined();
    expect(firstOpts.headers['X-PAYMENT']).toBeUndefined();

    // Second request: has X-PAYMENT header
    const [, secondOpts] = mockFetch.mock.calls[1];
    expect(secondOpts.headers['X-PAYMENT']).toBeDefined();
    const decoded = JSON.parse(atob(secondOpts.headers['X-PAYMENT']));
    expect(decoded.x402Version).toBe(2);
    expect(decoded.payload.authorization.from).toBe(mockSigner.address);
  });

  it('should NOT attempt x402 when apiKey is set', async () => {
    const client = new DedClient({
      baseUrl: 'http://localhost:8081',
      apiKey: 'test-key',
      signer: mockSigner,
    });

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 402,
      json: () => Promise.resolve({ message: 'Payment required' }),
    });

    await expect(client.fingerprints.submit([validSubmission])).rejects.toThrow(DedApiError);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('should throw DedApiError on 402 without signer', async () => {
    const client = new DedClient({
      baseUrl: 'http://localhost:8081',
    });

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 402,
      json: () => Promise.resolve({ message: 'Payment required' }),
    });

    await expect(client.fingerprints.submit([validSubmission])).rejects.toThrow(DedApiError);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('should throw DedApiError when 402 has no payment offers', async () => {
    const client = new DedClient({
      baseUrl: 'http://localhost:8081',
      signer: mockSigner,
    });

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 402,
      clone: () => ({
        json: () => Promise.resolve({ accepts: [] }),
      }),
      headers: new Headers(),
    });

    await expect(client.fingerprints.submit([validSubmission])).rejects.toThrow(
      '402 Payment Required but no payment offers received'
    );
  });

  it('should throw DedApiError when retry after payment fails', async () => {
    const client = new DedClient({
      baseUrl: 'http://localhost:8081',
      signer: mockSigner,
    });

    // First call: 402
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 402,
      clone: () => ({
        json: () => Promise.resolve(mock402Body),
      }),
      headers: new Headers(),
    });

    // Second call: server error
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: () => Promise.resolve({ message: 'Server error' }),
    });

    await expect(client.fingerprints.submit([validSubmission])).rejects.toThrow(DedApiError);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('should work with search (GET) via x402', async () => {
    const client = new DedClient({
      baseUrl: 'http://localhost:8081',
      signer: mockSigner,
    });

    // First call: 402
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 402,
      clone: () => ({
        json: () => Promise.resolve(mock402Body),
      }),
      headers: new Headers(),
    });

    // Second call: success
    const searchResult = { data: [], pagination: { hasMore: false } };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(searchResult),
    });

    const result = await client.fingerprints.search({ documentRef: 'abc' });
    expect(result).toEqual(searchResult);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('should preserve content-type on multipart retry', async () => {
    const client = new DedClient({
      baseUrl: 'http://localhost:8081',
      signer: mockSigner,
    });

    // First call: 402
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 402,
      clone: () => ({
        json: () => Promise.resolve(mock402Body),
      }),
      headers: new Headers(),
    });

    // Second call: success
    const uploadResult = { data: [{ eventId: 'e1', hash: 'h1', accepted: true, errors: [] }] };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(uploadResult),
    });

    const blob = new Blob(['test content'], { type: 'text/plain' });
    const docs = new Map([['a'.repeat(64), { blob, mimeType: 'text/plain' }]]);

    const result = await client.fingerprints.upload([validSubmission], docs);
    expect(result).toEqual(uploadResult);

    // Verify content-type preserved on retry
    const [, secondOpts] = mockFetch.mock.calls[1];
    expect(secondOpts.headers['Content-Type']).toMatch(/^multipart\/form-data; boundary=/);
    expect(secondOpts.headers['X-PAYMENT']).toBeDefined();
  });
});
