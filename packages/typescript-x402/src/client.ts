/**
 * Top-level x402 DED client.
 */

import {
  orgIdFromWallet,
  tenantIdFromWallet,
  FingerprintGenerator,
} from '@constellation-network/digital-evidence-sdk';
import type {
  FingerprintSubmission,
  GenerateOptions,
} from '@constellation-network/digital-evidence-sdk';
import { BatchesApi } from '@constellation-network/digital-evidence-sdk/network';

import { X402FingerprintsApi } from './fingerprints-api';
import { X402HttpClient } from './x402-http-client';
import type { X402Config } from './types';

/**
 * x402 pay-per-request client for the DED API.
 *
 * Uses an Ethereum wallet to sign EIP-3009 TransferWithAuthorization
 * payments instead of API key authentication.
 *
 * Organization and tenant IDs are deterministically derived from the
 * wallet address (UUID v5), so no prior registration is required.
 *
 * @example
 * ```ts
 * import { ethers } from 'ethers';
 * import { DedX402Client, createEthersSigner } from '@constellation-network/digital-evidence-sdk-x402';
 *
 * const wallet = new ethers.Wallet(process.env.ETH_PRIVATE_KEY!);
 * const client = new DedX402Client({
 *   baseUrl: 'https://de-api.constellationnetwork.io',
 *   signer: createEthersSigner(wallet),
 *   signingPrivateKey: process.env.DAG_PRIVATE_KEY!,
 * });
 *
 * // Generate with wallet-derived org/tenant IDs
 * const submission = await client.generateFingerprint({
 *   eventId: 'evt-1',
 *   documentId: 'doc-1',
 *   documentContent: 'Hello, world!',
 * });
 * const results = await client.fingerprints.submit([submission]);
 * ```
 */
export class DedX402Client {
  readonly fingerprints: X402FingerprintsApi;
  readonly batches: BatchesApi;

  /** Deterministic organization UUID derived from the wallet address */
  readonly orgId: string;
  /** Deterministic tenant UUID derived from the wallet address */
  readonly tenantId: string;

  private readonly _generator: FingerprintGenerator | null;
  private readonly _config: X402Config;

  constructor(config: X402Config) {
    this._config = config;
    const http = new X402HttpClient(config);
    this.fingerprints = new X402FingerprintsApi(http);
    this.batches = new BatchesApi(http as any);

    this.orgId = orgIdFromWallet(config.signer.address);
    this.tenantId = tenantIdFromWallet(config.signer.address);

    this._generator = config.signingPrivateKey
      ? new FingerprintGenerator({
          privateKey: config.signingPrivateKey,
          orgId: this.orgId,
          tenantId: this.tenantId,
        })
      : null;
  }

  /**
   * Generate a fingerprint submission with wallet-derived org/tenant IDs.
   *
   * Automatically fills in `orgId` and `tenantId` from the wallet address
   * if not provided in the options.
   *
   * Requires `signingPrivateKey` to be set in `X402Config`.
   *
   * @param options - Fingerprint generation options. `orgId` and `tenantId`
   *   are auto-populated from the wallet if omitted.
   * @returns A complete FingerprintSubmission ready for `client.fingerprints.submit()`.
   */
  async generateFingerprint(
    options: Omit<GenerateOptions, 'orgId' | 'tenantId'> & {
      orgId?: string;
      tenantId?: string;
    }
  ): Promise<FingerprintSubmission> {
    if (!this._generator) {
      throw new Error(
        'signingPrivateKey must be set in X402Config to generate fingerprints'
      );
    }

    return this._generator.generate({
      ...options,
      orgId: options.orgId || this.orgId,
      tenantId: options.tenantId || this.tenantId,
    });
  }

  /** The Ethereum wallet address used for payments. */
  get walletAddress(): string {
    return this._config.signer.address;
  }
}
