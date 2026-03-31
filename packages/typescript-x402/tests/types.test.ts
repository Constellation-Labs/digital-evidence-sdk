import { parsePaymentRequired } from '../src/eip712';

const SAMPLE_402_BODY = {
  x402Version: 2,
  resource: { url: '/v1/fingerprints', description: 'DED API: /v1/fingerprints' },
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

describe('parsePaymentRequired', () => {
  it('parses from JSON body', async () => {
    const response = new Response(JSON.stringify(SAMPLE_402_BODY), {
      status: 402,
      headers: { 'content-type': 'application/json' },
    });

    const result = await parsePaymentRequired(response);
    expect(result).not.toBeNull();
    expect(result!.x402Version).toBe(2);
    expect(result!.accepts).toHaveLength(1);
    expect(result!.accepts[0].payTo).toBe('0xRecipient');
  });

  it('parses from X-PAYMENT-REQUIRED header', async () => {
    const encoded = btoa(JSON.stringify(SAMPLE_402_BODY));
    const response = new Response('Payment Required', {
      status: 402,
      headers: {
        'content-type': 'text/plain',
        'X-PAYMENT-REQUIRED': encoded,
      },
    });

    const result = await parsePaymentRequired(response);
    expect(result).not.toBeNull();
    expect(result!.x402Version).toBe(2);
  });

  it('returns null when body has no accepts', async () => {
    const response = new Response(JSON.stringify({ error: 'something' }), {
      status: 402,
      headers: { 'content-type': 'application/json' },
    });

    const result = await parsePaymentRequired(response);
    expect(result).toBeNull();
  });
});
