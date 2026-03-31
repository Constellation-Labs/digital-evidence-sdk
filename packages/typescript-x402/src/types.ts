/**
 * x402 payment types for the DED SDK.
 */

/** A single payment offer from a 402 response */
export interface PaymentOffer {
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
  accepts: PaymentOffer[];
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

/** Payment payload sent base64-encoded in the X-PAYMENT header */
export interface PaymentPayload {
  x402Version: number;
  accepted: PaymentOffer;
  payload: {
    signature: string;
    authorization: TransferAuthorization;
  };
}

/** Configuration for the x402 DED client */
export interface X402Config {
  /** Base URL of the DED Ingestion API (e.g. "http://localhost:8081") */
  baseUrl: string;
  /** x402 signer for payment signing */
  signer: X402Signer;
  /** DAG/SECP256K1 private key for fingerprint signing (64-char hex). Required for generateFingerprint(). */
  signingPrivateKey?: string;
  /** Whether to automatically pay on 402 responses (default: true) */
  autoPay?: boolean;
  /** Request timeout in milliseconds (default: 30000) */
  timeout?: number;
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

/** Successful result from a paid endpoint */
export interface PaymentResult<T> {
  kind: 'result';
  data: T;
}

/** Payment required — returned when autoPay=false */
export interface PaymentRequiredResult {
  kind: 'payment_required';
  payment: X402PaymentRequired;
}

/** Union type for paid endpoint results */
export type PaymentOr<T> = PaymentResult<T> | PaymentRequiredResult;
