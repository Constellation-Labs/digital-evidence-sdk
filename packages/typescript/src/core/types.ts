/**
 * DED domain types matching DigitalEvidence_v1.proto.
 *
 * These types mirror the protobuf schema exactly:
 *   - FingerprintValue fields use camelCase (JSON mapping of proto snake_case)
 *   - SignatureProof.algorithm is the string enum name, not the numeric value
 *   - SignedFingerprint uses `content` (not metakit's `value`)
 */

export { type KeyPair, type Hash } from '@constellation-network/metagraph-sdk';

/** Signature algorithm enum — maps to SignatureProof.Algorithm in proto */
export type SignatureAlgorithm = 'SECP256K1_RFC8785_V1';

/** Core fingerprint data that gets signed. Maps to proto FingerprintValue. */
export interface FingerprintValue {
  orgId: string;
  tenantId: string;
  eventId: string;
  signerId?: string;
  documentId: string;
  documentRef: string;
  timestamp: string;
  version: number;
}

/**
 * Cryptographic signature proof. Maps to proto SignatureProof.
 *
 * Note: metakit's SignatureProof omits `algorithm` — DED adds it explicitly
 * because the proto schema requires it for forward compatibility.
 */
export interface DedSignatureProof {
  id: string;
  signature: string;
  algorithm: SignatureAlgorithm;
}

/**
 * Signed fingerprint wrapper. Maps to proto SignedFingerprint.
 *
 * Key difference from metakit's Signed<T>: uses `content` instead of `value`.
 * This matches the DED protobuf schema where the field is named `content`.
 */
export interface SignedFingerprint {
  content: FingerprintValue;
  proofs: DedSignatureProof[];
}

/** Optional metadata for categorization/indexing. Maps to proto FingerprintMetadata. */
export interface FingerprintMetadata {
  hash: string;
  tags?: Record<string, string>;
}

/** Complete submission structure. Maps to proto FingerprintSubmission. */
export interface FingerprintSubmission {
  attestation: SignedFingerprint;
  metadata?: FingerprintMetadata;
}

/** API response for each submitted fingerprint. Maps to proto FingerprintSubmissionResult. */
export interface FingerprintSubmissionResult {
  eventId: string;
  hash: string;
  accepted: boolean;
  errors: string[];
}

/** Options for the high-level generateFingerprint() function */
export interface GenerateOptions {
  orgId: string;
  tenantId: string;
  eventId: string;
  documentId: string;
  documentRef?: string;
  documentContent?: string | Uint8Array;
  timestamp?: Date;
  version?: number;
  includeMetadata?: boolean;
  tags?: Record<string, string>;
}
