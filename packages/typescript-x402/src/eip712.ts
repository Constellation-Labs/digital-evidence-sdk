/**
 * EIP-712 domain construction and EIP-3009 TransferWithAuthorization signing.
 */

import type {
  Eip712Domain,
  PaymentOffer,
  PaymentPayload,
  TransferAuthorization,
  X402PaymentRequired,
  X402Signer,
} from './types';

/** EIP-712 type definitions for EIP-3009 TransferWithAuthorization */
export const TRANSFER_WITH_AUTHORIZATION_TYPES: Record<
  string,
  Array<{ name: string; type: string }>
> = {
  TransferWithAuthorization: [
    { name: 'from', type: 'address' },
    { name: 'to', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'validAfter', type: 'uint256' },
    { name: 'validBefore', type: 'uint256' },
    { name: 'nonce', type: 'bytes32' },
  ],
};

/**
 * Build the EIP-712 domain from a payment offer.
 * Extracts chainId from the CAIP-2 network identifier (e.g. "eip155:84532" -> 84532).
 */
export function buildEip3009Domain(offer: PaymentOffer): Eip712Domain {
  const chainId = parseInt(offer.network.split(':')[1], 10);
  return {
    name: offer.extra?.name ?? 'USD Coin',
    version: offer.extra?.version ?? '2',
    chainId,
    verifyingContract: offer.asset,
  };
}

/** Build the TransferWithAuthorization message struct. */
export function buildAuthorization(
  fromAddress: string,
  offer: PaymentOffer,
  validForSeconds = 300
): TransferAuthorization {
  const now = Math.floor(Date.now() / 1000);
  const randomBytes = new Uint8Array(32);
  crypto.getRandomValues(randomBytes);
  const nonce =
    '0x' +
    Array.from(randomBytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

  return {
    from: fromAddress,
    to: offer.payTo,
    value: String(offer.amount),
    validAfter: '0',
    validBefore: String(now + validForSeconds),
    nonce,
  };
}

/**
 * Parse a 402 response to extract payment requirements.
 * Tries the JSON body first, then falls back to the X-PAYMENT-REQUIRED header.
 */
export async function parsePaymentRequired(
  response: Response
): Promise<X402PaymentRequired | null> {
  // Try body
  try {
    const body = (await response.clone().json()) as Record<string, unknown>;
    if (body && Array.isArray(body['accepts'])) {
      return body as unknown as X402PaymentRequired;
    }
  } catch {
    // fall through to header
  }

  // Fallback: X-PAYMENT-REQUIRED header (base64 JSON)
  const raw = response.headers.get('X-PAYMENT-REQUIRED');
  if (!raw) return null;
  return JSON.parse(atob(raw)) as X402PaymentRequired;
}

/**
 * Sign an x402 payment and return the base64-encoded X-PAYMENT header value.
 *
 * Performs the full EIP-3009 TransferWithAuthorization signing flow.
 */
export async function buildPaymentHeader(
  offer: PaymentOffer,
  signer: X402Signer,
  validForSeconds = 300
): Promise<string> {
  const domain = buildEip3009Domain(offer);
  const authorization = buildAuthorization(signer.address, offer, validForSeconds);
  const signature = await signer.signTypedData(
    domain,
    TRANSFER_WITH_AUTHORIZATION_TYPES,
    authorization as unknown as Record<string, unknown>
  );

  const paymentPayload: PaymentPayload = {
    x402Version: 2,
    accepted: {
      scheme: offer.scheme,
      network: offer.network,
      amount: String(offer.amount),
      asset: offer.asset,
      payTo: offer.payTo,
      maxTimeoutSeconds: offer.maxTimeoutSeconds,
      extra: offer.extra ?? {},
    },
    payload: {
      signature,
      authorization,
    },
  };

  return btoa(JSON.stringify(paymentPayload));
}
