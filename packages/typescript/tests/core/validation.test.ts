import {
  FingerprintValueSchema,
  SignatureProofSchema,
  FingerprintMetadataSchema,
  validateSubmission,
  safeValidateSubmission,
} from '../../src/core/validation';
import { ValidationError } from '../../src/core/errors';
import type { FingerprintSubmission } from '../../src/core/types';

const validValue = {
  orgId: '550e8400-e29b-41d4-a716-446655440000',
  tenantId: '123e4567-e89b-12d3-a456-426614174000',
  eventId: '7ca8c920-0ead-22e2-91c5-11d05fe540d9',
  documentId: 'contract-2024-001',
  documentRef: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  timestamp: '2024-01-15T10:30:00.000Z',
  version: 1,
};

const validProof = {
  id: 'a'.repeat(128),
  signature: 'b'.repeat(128),
  algorithm: 'SECP256K1_RFC8785_V1' as const,
};

const validSubmission: FingerprintSubmission = {
  attestation: {
    content: validValue,
    proofs: [validProof],
  },
};

describe('FingerprintValueSchema', () => {
  it('should accept a valid FingerprintValue', () => {
    expect(FingerprintValueSchema.safeParse(validValue).success).toBe(true);
  });

  it('should reject invalid UUID for orgId', () => {
    const result = FingerprintValueSchema.safeParse({
      ...validValue,
      orgId: 'not-a-uuid',
    });
    expect(result.success).toBe(false);
  });

  it('should reject documentRef shorter than 32 characters', () => {
    const result = FingerprintValueSchema.safeParse({
      ...validValue,
      documentRef: 'abc123',
    });
    expect(result.success).toBe(false);
  });

  it('should reject non-hex documentRef', () => {
    const result = FingerprintValueSchema.safeParse({
      ...validValue,
      documentRef: 'g'.repeat(64),
    });
    expect(result.success).toBe(false);
  });

  it('should reject version < 1', () => {
    const result = FingerprintValueSchema.safeParse({
      ...validValue,
      version: 0,
    });
    expect(result.success).toBe(false);
  });

  it('should accept value without signerId (optional)', () => {
    const { signerId: _, ...withoutSigner } = { ...validValue, signerId: undefined };
    const result = FingerprintValueSchema.safeParse(withoutSigner);
    expect(result.success).toBe(true);
  });

  it('should reject signerId shorter than 64 chars', () => {
    const result = FingerprintValueSchema.safeParse({
      ...validValue,
      signerId: 'a'.repeat(32),
    });
    expect(result.success).toBe(false);
  });
});

describe('SignatureProofSchema', () => {
  it('should accept a valid proof', () => {
    expect(SignatureProofSchema.safeParse(validProof).success).toBe(true);
  });

  it('should reject wrong algorithm', () => {
    const result = SignatureProofSchema.safeParse({
      ...validProof,
      algorithm: 'UNKNOWN',
    });
    expect(result.success).toBe(false);
  });

  it('should reject non-hex signature', () => {
    const result = SignatureProofSchema.safeParse({
      ...validProof,
      signature: 'z'.repeat(128),
    });
    expect(result.success).toBe(false);
  });
});

describe('FingerprintMetadataSchema', () => {
  it('should accept valid metadata with tags', () => {
    const result = FingerprintMetadataSchema.safeParse({
      hash: 'a'.repeat(64),
      tags: { key: 'value' },
    });
    expect(result.success).toBe(true);
  });

  it('should reject more than 6 tag pairs', () => {
    const tags: Record<string, string> = {};
    for (let i = 0; i < 7; i++) {
      tags[`key${i}`] = `val${i}`;
    }
    const result = FingerprintMetadataSchema.safeParse({
      hash: 'a'.repeat(64),
      tags,
    });
    expect(result.success).toBe(false);
  });

  it('should reject tag key longer than 32 chars', () => {
    const result = FingerprintMetadataSchema.safeParse({
      hash: 'a'.repeat(64),
      tags: { ['k'.repeat(33)]: 'value' },
    });
    expect(result.success).toBe(false);
  });
});

describe('validateSubmission', () => {
  it('should not throw for a valid submission', () => {
    expect(() => validateSubmission(validSubmission)).not.toThrow();
  });

  it('should throw ValidationError for invalid submission', () => {
    const invalid = {
      attestation: {
        content: { ...validValue, orgId: 'bad' },
        proofs: [validProof],
      },
    } as FingerprintSubmission;

    expect(() => validateSubmission(invalid)).toThrow(ValidationError);
  });
});

describe('safeValidateSubmission', () => {
  it('should return success: true for valid submission', () => {
    const result = safeValidateSubmission(validSubmission);
    expect(result.success).toBe(true);
    expect(result.issues).toBeUndefined();
  });

  it('should return issues for invalid submission', () => {
    const invalid = {
      attestation: {
        content: { ...validValue, version: 0 },
        proofs: [],
      },
    } as FingerprintSubmission;

    const result = safeValidateSubmission(invalid);
    expect(result.success).toBe(false);
    expect(result.issues).toBeDefined();
    expect(result.issues!.length).toBeGreaterThan(0);
  });
});
