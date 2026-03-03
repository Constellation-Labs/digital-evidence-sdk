import { sign, getPublicKeyId } from '@constellation-network/metagraph-sdk';
import { SigningError } from './errors';
import { hashDocument } from './document';
import { createMetadata } from './metadata';
import type {
  FingerprintValue,
  DedSignatureProof,
  SignedFingerprint,
  FingerprintSubmission,
  GenerateOptions,
} from './types';

/**
 * Build a FingerprintValue object from the provided options.
 *
 * Does NOT sign — just assembles the plaintext value. If `documentRef` is not
 * provided, it will be computed from `documentContent` via SHA-256.
 *
 * @param options - Fingerprint generation options
 * @param signerPublicKeyId - Optional 128-char hex public key (no 04 prefix).
 *   If omitted, signerId is not included in the value.
 * @returns A FingerprintValue ready for signing
 */
export function createFingerprintValue(
  options: GenerateOptions,
  signerPublicKeyId?: string
): FingerprintValue {
  const documentRef =
    options.documentRef ??
    (options.documentContent ? hashDocument(options.documentContent) : undefined);

  if (!documentRef) {
    throw new SigningError('Either documentRef or documentContent must be provided');
  }

  const timestamp = (options.timestamp ?? new Date()).toISOString();

  const value: FingerprintValue = {
    orgId: options.orgId,
    tenantId: options.tenantId,
    eventId: options.eventId,
    documentId: options.documentId,
    documentRef,
    timestamp,
    version: options.version ?? 1,
  };

  if (signerPublicKeyId) {
    value.signerId = signerPublicKeyId;
  }

  return value;
}

/**
 * Sign a FingerprintValue, producing a DED-compatible SignedFingerprint.
 *
 * This wraps metakit's `sign()` function but adapts the output to DED's format:
 *   - metakit produces `{ value, proofs }` where proofs have `{ id, signature }`
 *   - DED expects `{ content, proofs }` where proofs have `{ id, signature, algorithm }`
 *
 * Signing protocol (SECP256K1_RFC8785_V1):
 *   1. RFC 8785 canonicalize the FingerprintValue
 *   2. SHA-256 hash the canonical JSON bytes
 *   3. The hex hash string is treated as UTF-8 text → SHA-512 → truncate to 32 bytes
 *   4. ECDSA sign with SECP256K1
 *
 * @param value - The FingerprintValue to sign
 * @param privateKey - 64-character hex private key
 * @returns SignedFingerprint with `content` field and algorithm-tagged proofs
 */
export async function signFingerprint(
  value: FingerprintValue,
  privateKey: string
): Promise<SignedFingerprint> {
  try {
    // metakit's sign() handles: canonicalize → SHA-256 → hex-as-UTF8 → SHA-512 → truncate → ECDSA
    const metakitProof = await sign(value, privateKey);

    const dedProof: DedSignatureProof = {
      id: metakitProof.id,
      signature: metakitProof.signature,
      algorithm: 'SECP256K1_RFC8785_V1',
    };

    return {
      content: value,
      proofs: [dedProof],
    };
  } catch (err) {
    throw new SigningError(
      `Failed to sign fingerprint: ${err instanceof Error ? err.message : String(err)}`,
      err
    );
  }
}

/**
 * High-level one-call API: create, sign, and package a FingerprintSubmission.
 *
 * This combines createFingerprintValue + signFingerprint + optional metadata
 * into a single async call, matching the workflow in the e2e tests.
 *
 * @param options - Fingerprint generation options (orgId, tenantId, eventId, etc.)
 * @param privateKey - 64-character hex private key for signing
 * @returns Complete FingerprintSubmission ready for API submission
 */
export async function generateFingerprint(
  options: GenerateOptions,
  privateKey: string
): Promise<FingerprintSubmission> {
  const publicKeyId = getPublicKeyId(privateKey);
  const value = createFingerprintValue(options, publicKeyId);
  const signedFingerprint = await signFingerprint(value, privateKey);

  const metadata =
    options.includeMetadata || options.tags ? createMetadata(value, options.tags) : undefined;

  return {
    attestation: signedFingerprint,
    ...(metadata && { metadata }),
  };
}

/**
 * Stateful helper that holds a private key and default org/tenant IDs,
 * simplifying repeated fingerprint generation.
 */
export class FingerprintGenerator {
  private readonly privateKey: string;
  private readonly publicKeyId: string;
  private readonly defaults: { orgId?: string; tenantId?: string };

  constructor(config: { privateKey: string; orgId?: string; tenantId?: string }) {
    this.privateKey = config.privateKey;
    this.publicKeyId = getPublicKeyId(config.privateKey);
    this.defaults = { orgId: config.orgId, tenantId: config.tenantId };
  }

  /** Generate a complete FingerprintSubmission, merging defaults with provided options. */
  async generate(
    options: Partial<GenerateOptions> &
      Pick<GenerateOptions, 'eventId' | 'documentId'> & {
        orgId?: string;
        tenantId?: string;
        documentRef?: string;
        documentContent?: string | Uint8Array;
      }
  ): Promise<FingerprintSubmission> {
    const merged: GenerateOptions = {
      orgId: options.orgId ?? this.defaults.orgId ?? '',
      tenantId: options.tenantId ?? this.defaults.tenantId ?? '',
      eventId: options.eventId,
      documentId: options.documentId,
      documentRef: options.documentRef,
      documentContent: options.documentContent,
      timestamp: options.timestamp,
      version: options.version,
      includeMetadata: options.includeMetadata,
      tags: options.tags,
    };

    return generateFingerprint(merged, this.privateKey);
  }

  /** Get the public key ID (128-char hex, no 04 prefix) for this generator. */
  getPublicKeyId(): string {
    return this.publicKeyId;
  }
}
