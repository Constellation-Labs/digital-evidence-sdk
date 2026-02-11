import { hashBytes } from '@constellation-network/metagraph-sdk';

/**
 * Hash document content using SHA-256, returning a hex string.
 *
 * This is the standard way to produce a `documentRef` for a FingerprintValue.
 * Accepts either a UTF-8 string or raw bytes (Uint8Array).
 *
 * @param content - Document content as string or bytes
 * @returns Hex-encoded SHA-256 hash (64 characters)
 */
export function hashDocument(content: string | Uint8Array): string {
  const bytes =
    typeof content === 'string'
      ? new TextEncoder().encode(content)
      : content;
  return hashBytes(bytes).value;
}
