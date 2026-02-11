import { z } from 'zod';
import { ValidationError } from './errors';
import type { FingerprintSubmission } from './types';

/** Hex string pattern matching proto's hex validation */
const hexPattern = /^[0-9a-fA-F]+$/;

/** UUID v4 pattern (loose — accepts any UUID-shaped string) */
const uuidPattern =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

/** Zod schema for FingerprintValue, matching proto validation rules */
export const FingerprintValueSchema = z.object({
  orgId: z.string().regex(uuidPattern, 'orgId must be a valid UUID'),
  tenantId: z.string().regex(uuidPattern, 'tenantId must be a valid UUID'),
  eventId: z.string().regex(uuidPattern, 'eventId must be a valid UUID'),
  signerId: z
    .string()
    .min(64, 'signerId must be at least 64 characters')
    .max(140, 'signerId must be at most 140 characters')
    .regex(hexPattern, 'signerId must be hex-encoded')
    .optional(),
  documentId: z
    .string()
    .min(1, 'documentId is required')
    .max(256, 'documentId must be at most 256 characters'),
  documentRef: z
    .string()
    .min(32, 'documentRef must be at least 32 characters')
    .max(128, 'documentRef must be at most 128 characters')
    .regex(hexPattern, 'documentRef must be hex-encoded'),
  timestamp: z.string().min(1, 'timestamp is required'),
  version: z.number().int().min(1, 'version must be >= 1'),
});

/** Zod schema for DedSignatureProof, matching proto SignatureProof */
export const SignatureProofSchema = z.object({
  id: z
    .string()
    .min(1, 'id is required')
    .max(140, 'id must be at most 140 characters')
    .regex(hexPattern, 'id must be hex-encoded'),
  signature: z
    .string()
    .min(64, 'signature must be at least 64 characters')
    .max(2048, 'signature must be at most 2048 characters')
    .regex(hexPattern, 'signature must be hex-encoded'),
  algorithm: z.literal('SECP256K1_RFC8785_V1'),
});

/** Zod schema for FingerprintMetadata */
export const FingerprintMetadataSchema = z.object({
  hash: z
    .string()
    .min(32)
    .max(128)
    .regex(hexPattern, 'hash must be hex-encoded'),
  tags: z
    .record(
      z.string().min(1).max(32),
      z.string().max(32)
    )
    .refine((tags) => Object.keys(tags).length <= 6, {
      message: 'tags must have at most 6 pairs',
    })
    .optional(),
});

/** Zod schema for a complete FingerprintSubmission */
export const FingerprintSubmissionSchema = z.object({
  attestation: z.object({
    content: FingerprintValueSchema,
    proofs: z
      .array(SignatureProofSchema)
      .min(1, 'at least one proof is required'),
  }),
  metadata: FingerprintMetadataSchema.optional(),
});

/**
 * Validate a FingerprintSubmission, throwing a ValidationError if invalid.
 *
 * @param submission - The submission to validate
 * @throws ValidationError with structured issue list
 */
export function validateSubmission(submission: FingerprintSubmission): void {
  const result = FingerprintSubmissionSchema.safeParse(submission);
  if (!result.success) {
    const issues = result.error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    }));
    throw new ValidationError('Invalid FingerprintSubmission', issues);
  }
}

/**
 * Validate a FingerprintSubmission without throwing.
 *
 * @param submission - The submission to validate
 * @returns Object with `success` boolean and optional `issues` array
 */
export function safeValidateSubmission(submission: FingerprintSubmission): {
  success: boolean;
  issues?: Array<{ path: string; message: string }>;
} {
  const result = FingerprintSubmissionSchema.safeParse(submission);
  if (result.success) {
    return { success: true };
  }
  return {
    success: false,
    issues: result.error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    })),
  };
}
