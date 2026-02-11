import { canonicalize, hashBytes } from '@constellation-network/metagraph-sdk';
import type { FingerprintValue, FingerprintMetadata } from './types';

/**
 * Compute the SHA-256 hash of a FingerprintValue's canonical JSON.
 *
 * This follows the same process the server uses to produce the metadata hash:
 * 1. Canonicalize the FingerprintValue object per RFC 8785
 * 2. Encode the canonical string as UTF-8 bytes
 * 3. SHA-256 hash those bytes
 *
 * @param value - The FingerprintValue to hash
 * @returns Hex-encoded SHA-256 hash (64 characters)
 */
export function computeMetadataHash(value: FingerprintValue): string {
  const canonical = canonicalize(value);
  const bytes = new TextEncoder().encode(canonical);
  return hashBytes(bytes).value;
}

/**
 * Create a FingerprintMetadata object with the computed hash and optional tags.
 *
 * @param value - The FingerprintValue to derive the hash from
 * @param tags  - Optional key-value tags for indexing (max 6 pairs per proto)
 * @returns FingerprintMetadata ready for inclusion in a FingerprintSubmission
 */
export function createMetadata(
  value: FingerprintValue,
  tags?: Record<string, string>
): FingerprintMetadata {
  return {
    hash: computeMetadataHash(value),
    ...(tags && { tags }),
  };
}
