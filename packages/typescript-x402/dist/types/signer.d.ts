/**
 * x402 signer utilities.
 */
import type { EthersWalletLike, X402Signer } from './types';
/**
 * Create an {@link X402Signer} from an ethers.js v6 Wallet (or any compatible object).
 *
 * @example
 * ```ts
 * import { ethers } from 'ethers';
 * import { createEthersSigner } from '@constellation-network/digital-evidence-sdk-x402';
 *
 * const wallet = new ethers.Wallet(privateKey);
 * const signer = createEthersSigner(wallet);
 * ```
 */
export declare function createEthersSigner(wallet: EthersWalletLike): X402Signer;
