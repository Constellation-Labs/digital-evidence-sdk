import { buildEip3009Domain, buildAuthorization } from '../src/eip712';
import type { PaymentOffer } from '../src/types';

function makeOffer(overrides: Partial<PaymentOffer> = {}): PaymentOffer {
  return {
    scheme: 'exact',
    network: 'eip155:84532',
    amount: '20000',
    asset: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
    payTo: '0xRecipient',
    maxTimeoutSeconds: 60,
    extra: { name: 'USD Coin', version: '2' },
    ...overrides,
  };
}

describe('buildEip3009Domain', () => {
  it('extracts chainId from CAIP-2 network string', () => {
    const domain = buildEip3009Domain(makeOffer({ network: 'eip155:84532' }));
    expect(domain.chainId).toBe(84532);
    expect(domain.verifyingContract).toBe('0x036CbD53842c5426634e7929541eC2318f3dCF7e');
    expect(domain.name).toBe('USD Coin');
    expect(domain.version).toBe('2');
  });

  it('handles Base mainnet', () => {
    const domain = buildEip3009Domain(makeOffer({ network: 'eip155:8453' }));
    expect(domain.chainId).toBe(8453);
  });

  it('uses defaults when extra is undefined', () => {
    const domain = buildEip3009Domain(makeOffer({ extra: undefined }));
    expect(domain.name).toBe('USD Coin');
    expect(domain.version).toBe('2');
  });
});

describe('buildAuthorization', () => {
  it('builds correct authorization struct', () => {
    const offer = makeOffer();
    const auth = buildAuthorization('0xSender', offer, 300);

    expect(auth.from).toBe('0xSender');
    expect(auth.to).toBe(offer.payTo);
    expect(auth.value).toBe(String(offer.amount));
    expect(auth.validAfter).toBe('0');
    expect(auth.nonce).toMatch(/^0x[0-9a-f]{64}$/);

    const validBefore = parseInt(auth.validBefore, 10);
    const now = Math.floor(Date.now() / 1000);
    expect(validBefore).toBeGreaterThanOrEqual(now + 295);
    expect(validBefore).toBeLessThanOrEqual(now + 305);
  });

  it('generates unique nonces', () => {
    const offer = makeOffer();
    const auth1 = buildAuthorization('0xSender', offer);
    const auth2 = buildAuthorization('0xSender', offer);
    expect(auth1.nonce).not.toBe(auth2.nonce);
  });
});
