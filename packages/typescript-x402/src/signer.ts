/**
 * x402 signer utilities.
 */

import type { Eip712Domain, EthersWalletLike, X402Signer } from './types';

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
export function createEthersSigner(wallet: EthersWalletLike): X402Signer {
  return {
    get address() {
      return wallet.address;
    },
    async signTypedData(
      domain: Eip712Domain,
      types: Record<string, Array<{ name: string; type: string }>>,
      value: Record<string, unknown>
    ): Promise<string> {
      return wallet.signTypedData(
        domain as unknown as Record<string, unknown>,
        types,
        value
      );
    },
  };
}
