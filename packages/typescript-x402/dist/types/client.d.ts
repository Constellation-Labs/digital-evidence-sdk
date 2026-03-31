/**
 * Top-level x402 DED client.
 */
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
 * const wallet = new ethers.Wallet(process.env.PRIVATE_KEY!);
 * const client = new DedX402Client({
 *   baseUrl: 'https://de-api.constellationnetwork.io',
 *   signer: createEthersSigner(wallet),
 * });
 *
 * const results = await client.fingerprints.submit(submissions);
 * ```
 */
export declare class DedX402Client {
    readonly fingerprints: X402FingerprintsApi;
    readonly batches: BatchesApi;
    /** Deterministic organization UUID derived from the wallet address */
    readonly orgId: string;
    /** Deterministic tenant UUID derived from the wallet address */
    readonly tenantId: string;
    constructor(config: X402Config);
    /** The Ethereum wallet address used for payments. */
    get walletAddress(): string;
}
