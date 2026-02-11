/**
 * @constellation-network/ded-sdk — Core module
 *
 * Pure cryptographic operations for creating, signing, and validating
 * DED fingerprint submissions. No network dependencies.
 */

// DED domain types
export type {
  FingerprintValue,
  DedSignatureProof,
  SignedFingerprint,
  FingerprintMetadata,
  FingerprintSubmission,
  FingerprintSubmissionResult,
  GenerateOptions,
  SignatureAlgorithm,
} from './types';

// Re-export metakit types used by consumers
export type { KeyPair, Hash } from './types';

// DED fingerprint operations
export {
  createFingerprintValue,
  signFingerprint,
  generateFingerprint,
  FingerprintGenerator,
} from './fingerprint';

// Document hashing
export { hashDocument } from './document';

// Metadata
export { computeMetadataHash, createMetadata } from './metadata';

// Validation (Zod schemas + helpers)
export {
  FingerprintValueSchema,
  SignatureProofSchema,
  FingerprintMetadataSchema,
  FingerprintSubmissionSchema,
  validateSubmission,
  safeValidateSubmission,
} from './validation';

// Error hierarchy
export { DedSdkError, ValidationError, SigningError } from './errors';

// Re-export metakit crypto primitives for advanced use
export {
  // Wallet
  generateKeyPair,
  keyPairFromPrivateKey,
  getPublicKeyHex,
  getPublicKeyId,
  getAddress,
  isValidPrivateKey,
  isValidPublicKey,
  // Signing & verification
  sign,
  verify,
  verifyHash,
  verifySignature,
  // Hashing
  hash,
  hashBytes,
  // Canonicalization
  canonicalize,
} from '@constellation-network/metagraph-sdk';
