import { X402HttpClient, X402ApiError } from '../src/x402-http-client';
import type { X402Config, X402Signer } from '../src/types';

const SAMPLE_402_BODY = {
  x402Version: 2,
  resource: { url: '/v1/fingerprints', description: 'DED API' },
  accepts: [
    {
      scheme: 'exact',
      network: 'eip155:84532',
      amount: '20000',
      asset: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
      payTo: '0xRecipient',
      maxTimeoutSeconds: 60,
      extra: { name: 'USD Coin', version: '2' },
    },
  ],
};

function makeSigner(): X402Signer {
  return {
    address: '0x2c7536E3605D9C16a7a3D7b1898e529396a65c23',
    signTypedData: jest.fn().mockResolvedValue('0x' + 'ab'.repeat(65)),
  };
}

function makeConfig(autoPay = true): X402Config {
  return {
    baseUrl: 'http://localhost:8081',
    signer: makeSigner(),
    autoPay,
    timeout: 5000,
  };
}

function mockFetch(responses: Array<{ status: number; body?: unknown; headers?: Record<string, string> }>) {
  let callIndex = 0;
  const calls: Array<{ url: string; init: RequestInit }> = [];

  const mock = jest.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const resp = responses[callIndex++];
    calls.push({ url: url.toString(), init: init ?? {} });

    const bodyStr = resp.body !== undefined ? JSON.stringify(resp.body) : '';
    return new Response(bodyStr, {
      status: resp.status,
      headers: {
        'content-type': 'application/json',
        ...(resp.headers ?? {}),
      },
    });
  });

  return { mock, calls };
}

describe('X402HttpClient', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('returns result on 200 without payment flow', async () => {
    const { mock } = mockFetch([{ status: 200, body: [{ eventId: 'e1' }] }]);
    global.fetch = mock;

    const client = new X402HttpClient(makeConfig());
    const result = await client.postWithPayment('/v1/fingerprints', [{}]);

    expect(result.kind).toBe('result');
    if (result.kind === 'result') {
      expect(result.data).toEqual([{ eventId: 'e1' }]);
    }
    expect(mock).toHaveBeenCalledTimes(1);
  });

  it('handles 402 with auto-pay', async () => {
    const { mock, calls } = mockFetch([
      { status: 402, body: SAMPLE_402_BODY },
      { status: 200, body: [{ eventId: 'e1' }] },
    ]);
    global.fetch = mock;

    const config = makeConfig(true);
    const client = new X402HttpClient(config);
    const result = await client.postWithPayment('/v1/fingerprints', [{}]);

    expect(result.kind).toBe('result');
    expect(mock).toHaveBeenCalledTimes(2);

    // Second call should have X-PAYMENT header
    const retryHeaders = calls[1].init.headers as Record<string, string>;
    expect(retryHeaders['X-PAYMENT']).toBeDefined();
    expect(config.signer.signTypedData).toHaveBeenCalledTimes(1);
  });

  it('returns payment_required when autoPay=false', async () => {
    const { mock } = mockFetch([{ status: 402, body: SAMPLE_402_BODY }]);
    global.fetch = mock;

    const config = makeConfig(false);
    const client = new X402HttpClient(config);
    const result = await client.postWithPayment('/v1/fingerprints', [{}]);

    expect(result.kind).toBe('payment_required');
    if (result.kind === 'payment_required') {
      expect(result.payment.accepts[0].amount).toBe('20000');
    }
    expect(config.signer.signTypedData).not.toHaveBeenCalled();
  });

  it('throws X402ApiError on 500', async () => {
    const { mock } = mockFetch([
      { status: 500, body: { message: 'Internal Server Error' } },
    ]);
    global.fetch = mock;

    const client = new X402HttpClient(makeConfig());
    await expect(client.postWithPayment('/v1/fingerprints', [{}])).rejects.toThrow(
      X402ApiError
    );
  });

  it('getPublic works without payment flow', async () => {
    const { mock } = mockFetch([{ status: 200, body: { data: { hash: 'abc' } } }]);
    global.fetch = mock;

    const client = new X402HttpClient(makeConfig());
    const result = await client.getPublic('/v1/fingerprints/abc');

    expect(result).toEqual({ data: { hash: 'abc' } });
  });

  it('first request has no X-PAYMENT or X-Api-Key header', async () => {
    const { mock, calls } = mockFetch([{ status: 200, body: [] }]);
    global.fetch = mock;

    const client = new X402HttpClient(makeConfig());
    await client.postWithPayment('/v1/fingerprints', [{}]);

    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers['X-PAYMENT']).toBeUndefined();
    expect(headers['X-Api-Key']).toBeUndefined();
  });
});
