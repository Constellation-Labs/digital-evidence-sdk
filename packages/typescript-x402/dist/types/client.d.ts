/**
 * Top-level x402 DED client.
 */
import type { FingerprintSubmission, GenerateOptions } from '@constellation-network/digital-evidence-sdk';
import { BatchesApi } from '@constellation-network/digital-evidence-sdk/network';
import { X402FingerprintsApi } from './fingerprints-api';
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
export declare class DedX402Client {
    readonly fingerprints: X402FingerprintsApi;
    readonly batches: BatchesApi;
    /** Deterministic organization UUID derived from the wallet address */
    readonly orgId: string;
    /** Deterministic tenant UUID derived from the wallet address */
    readonly tenantId: string;
    private readonly _generator;
    private readonly _config;
    constructor(config: X402Config);
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
    generateFingerprint(options: Omit<GenerateOptions, 'orgId' | 'tenantId'> & {
        orgId?: string;
        tenantId?: string;
    }): Promise<FingerprintSubmission>;
    /** The Ethereum wallet address used for payments. */
    get walletAddress(): string;
}
