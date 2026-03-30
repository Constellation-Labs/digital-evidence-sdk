/**
 * Deterministic UUID v5 (SHA-1, RFC 4122 §4.3) derivation from Ethereum wallet addresses.
 *
 * Used by the x402 payment flow so both client and server can independently compute
 * the same orgId and tenantId from a wallet address, keeping the fingerprint
 * hash stable across the signing boundary.
 */

import { createHash } from 'crypto';

/** Fixed namespace for deriving organization UUIDs from wallet addresses. */
const ORG_NAMESPACE = 'd2b4722a-d82d-424a-8b18-3330b4ade651';

/** Fixed namespace for deriving tenant UUIDs from wallet addresses. */
const TENANT_NAMESPACE = '4bed9e61-6d07-4e26-9692-b81dd6994ff3';

/**
 * Generate a UUID v5 per RFC 4122 §4.3.
 *
 * @param namespace - UUID namespace string (e.g. "d2b4722a-d82d-424a-8b18-3330b4ade651")
 * @param name - The name to hash within the namespace
 * @returns UUID v5 string
 */
export function uuidV5(namespace: string, name: string): string {
  const nsBytes = Buffer.from(namespace.replace(/-/g, ''), 'hex');
  const nameBytes = Buffer.from(name, 'utf8');
  const hash = createHash('sha1')
    .update(Buffer.concat([nsBytes, nameBytes]))
    .digest();

  // Set version 5
  hash[6] = (hash[6] & 0x0f) | 0x50;
  // Set variant to RFC 4122
  hash[8] = (hash[8] & 0x3f) | 0x80;

  const hex = hash.subarray(0, 16).toString('hex');
  return (
    hex.slice(0, 8) +
    '-' +
    hex.slice(8, 12) +
    '-' +
    hex.slice(12, 16) +
    '-' +
    hex.slice(16, 20) +
    '-' +
    hex.slice(20, 32)
  );
}

/**
 * Derive a deterministic organization UUID from an Ethereum wallet address.
 * The address is normalized to lowercase before hashing.
 */
export function orgIdFromWallet(walletAddress: string): string {
  return uuidV5(ORG_NAMESPACE, walletAddress.toLowerCase());
}

/**
 * Derive a deterministic tenant UUID from an Ethereum wallet address.
 * The address is normalized to lowercase before hashing.
 */
export function tenantIdFromWallet(walletAddress: string): string {
  return uuidV5(TENANT_NAMESPACE, walletAddress.toLowerCase());
}
