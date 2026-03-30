/**
 * x402 pay-per-request types, payment logic, and signer utilities.
 */

// ── Types ────────────────────────────────────────────────────────────

/** A single payment offer from a 402 response */
export interface X402PaymentOffer {
  scheme: string;
  network: string;
  amount: string;
  asset: string;
  payTo: string;
  maxTimeoutSeconds: number;
  extra?: { name?: string; version?: string; facilitatorUrl?: string };
}

/** The full 402 response body */
export interface X402PaymentRequired {
  x402Version: number;
  resource: { url: string; description: string };
  accepts: X402PaymentOffer[];
}

/** EIP-712 domain for signing */
export interface Eip712Domain {
  name: string;
  version: string;
  chainId: number;
  verifyingContract: string;
}

/** EIP-3009 TransferWithAuthorization message */
export interface TransferAuthorization {
  from: string;
  to: string;
  value: string;
  validAfter: string;
  validBefore: string;
  nonce: string;
}

/**
 * Abstract signer interface for x402 payments.
 *
 * Any object implementing this interface can be used for x402 payment signing.
 * Use {@link createEthersSigner} to create one from an ethers.js Wallet.
 */
export interface X402Signer {
  readonly address: string;
  signTypedData(
    domain: Eip712Domain,
    types: Record<string, Array<{ name: string; type: string }>>,
    value: Record<string, unknown>
  ): Promise<string>;
}

/**
 * Minimal interface matching ethers.js v6 Wallet.
 * Any object with these properties will work — avoids importing ethers as a dependency.
 */
export interface EthersWalletLike {
  readonly address: string;
  signTypedData(
    domain: Record<string, unknown>,
    types: Record<string, Array<{ name: string; type: string }>>,
    value: Record<string, unknown>
  ): Promise<string>;
}

// ── Constants ────────────────────────────────────────────────────────

const TRANSFER_WITH_AUTHORIZATION_TYPES = {
  TransferWithAuthorization: [
    { name: 'from', type: 'address' },
    { name: 'to', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'validAfter', type: 'uint256' },
    { name: 'validBefore', type: 'uint256' },
    { name: 'nonce', type: 'bytes32' },
  ],
};

// ── Payment logic ────────────────────────────────────────────────────

/**
 * Parse a 402 response to extract payment offers.
 * Tries the JSON body first, then falls back to the X-PAYMENT-REQUIRED header.
 */
export async function parsePaymentRequired(
  response: Response
): Promise<X402PaymentRequired | null> {
  try {
    const body = (await response.clone().json()) as Record<string, unknown>;
    if (body && Array.isArray(body['accepts'])) {
      return body as unknown as X402PaymentRequired;
    }
  } catch {
    // fall through to header
  }
  const raw = response.headers.get('X-PAYMENT-REQUIRED');
  if (!raw) return null;
  return JSON.parse(atob(raw)) as X402PaymentRequired;
}

/**
 * Build the base64-encoded X-PAYMENT header value from a payment offer.
 *
 * Signs an EIP-3009 TransferWithAuthorization using the provided signer.
 */
export async function buildPaymentHeader(
  offer: X402PaymentOffer,
  signer: X402Signer
): Promise<string> {
  const chainId = parseInt(offer.network.split(':')[1], 10);

  const domain: Eip712Domain = {
    name: offer.extra?.name ?? 'USD Coin',
    version: offer.extra?.version ?? '2',
    chainId,
    verifyingContract: offer.asset,
  };

  const now = Math.floor(Date.now() / 1000);
  const nonceBytes = new Uint8Array(32);
  crypto.getRandomValues(nonceBytes);
  const nonce =
    '0x' +
    Array.from(nonceBytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

  const authorization: TransferAuthorization = {
    from: signer.address,
    to: offer.payTo,
    value: offer.amount,
    validAfter: '0',
    validBefore: String(now + 300),
    nonce,
  };

  const signature = await signer.signTypedData(
    domain,
    TRANSFER_WITH_AUTHORIZATION_TYPES,
    authorization as unknown as Record<string, unknown>
  );

  const paymentPayload = {
    x402Version: 2,
    accepted: {
      scheme: offer.scheme || 'exact',
      network: offer.network,
      amount: String(offer.amount),
      asset: offer.asset,
      payTo: offer.payTo,
      maxTimeoutSeconds: offer.maxTimeoutSeconds || 60,
      extra: offer.extra || {},
    },
    payload: {
      signature,
      authorization,
    },
  };

  return btoa(JSON.stringify(paymentPayload));
}

// ── Ethers adapter ───────────────────────────────────────────────────

/**
 * Create an {@link X402Signer} from an ethers.js v6 Wallet (or any compatible object).
 *
 * @example
 * ```ts
 * import { ethers } from 'ethers';
 * import { createEthersSigner } from '@constellation-network/digital-evidence-sdk/network';
 *
 * const wallet = new ethers.Wallet(privateKey);
 * const signer = createEthersSigner(wallet);
 * ```
 */
export function createEthersSigner(wallet: EthersWalletLike): X402Signer {
  return {
    get address() {
      return wallet.address;
    },
    signTypedData(domain, types, value) {
      return wallet.signTypedData(
        domain as unknown as Record<string, unknown>,
        types,
        value
      );
    },
  };
}
