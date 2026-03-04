import {
  createFingerprintValue,
  signFingerprint,
  generateFingerprint,
  FingerprintGenerator,
} from '../../src/core/fingerprint';
import {
  generateKeyPair,
  getPublicKeyId,
  verifyHash,
  hash,
} from '@constellation-network/metagraph-sdk';
import type { FingerprintValue, GenerateOptions } from '../../src/core/types';

describe('createFingerprintValue', () => {
  const baseOptions: GenerateOptions = {
    orgId: '550e8400-e29b-41d4-a716-446655440000',
    tenantId: '123e4567-e89b-12d3-a456-426614174000',
    eventId: '7ca8c920-0ead-22e2-91c5-11d05fe540d9',
    documentId: 'contract-2024-001',
    documentRef: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  };

  it('should create a value with all required fields', () => {
    const value = createFingerprintValue(baseOptions);
    expect(value.orgId).toBe(baseOptions.orgId);
    expect(value.tenantId).toBe(baseOptions.tenantId);
    expect(value.eventId).toBe(baseOptions.eventId);
    expect(value.documentId).toBe(baseOptions.documentId);
    expect(value.documentRef).toBe(baseOptions.documentRef);
    expect(value.version).toBe(1);
    expect(value.timestamp).toBeDefined();
    expect(value.signerId).toBeUndefined();
  });

  it('should include signerId when provided', () => {
    const keyPair = generateKeyPair();
    const publicKeyId = getPublicKeyId(keyPair.privateKey);
    const value = createFingerprintValue(baseOptions, publicKeyId);
    expect(value.signerId).toBe(publicKeyId);
    expect(value.signerId).toHaveLength(128);
  });

  it('should compute documentRef from documentContent if documentRef not given', () => {
    const opts: GenerateOptions = {
      ...baseOptions,
      documentRef: undefined,
      documentContent: 'test content',
    };
    const value = createFingerprintValue(opts);
    expect(value.documentRef).toHaveLength(64);
    expect(value.documentRef).toMatch(/^[0-9a-f]+$/);
  });

  it('should throw if neither documentRef nor documentContent provided', () => {
    const opts: GenerateOptions = {
      ...baseOptions,
      documentRef: undefined,
    };
    expect(() => createFingerprintValue(opts)).toThrow(
      'Either documentRef or documentContent must be provided'
    );
  });

  it('should use provided timestamp', () => {
    const date = new Date('2024-01-15T10:30:00.000Z');
    const value = createFingerprintValue({ ...baseOptions, timestamp: date });
    expect(value.timestamp).toBe('2024-01-15T10:30:00.000Z');
  });

  it('should use provided version', () => {
    const value = createFingerprintValue({ ...baseOptions, version: 3 });
    expect(value.version).toBe(3);
  });
});

describe('signFingerprint', () => {
  const testValue: FingerprintValue = {
    orgId: '550e8400-e29b-41d4-a716-446655440000',
    tenantId: '123e4567-e89b-12d3-a456-426614174000',
    eventId: '7ca8c920-0ead-22e2-91c5-11d05fe540d9',
    documentId: 'contract-2024-001',
    documentRef: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    timestamp: '2024-01-15T10:30:00.000Z',
    version: 1,
  };

  it('should produce a SignedFingerprint with content and proofs', async () => {
    const keyPair = generateKeyPair();
    const signed = await signFingerprint(testValue, keyPair.privateKey);

    expect(signed.content).toEqual(testValue);
    expect(signed.proofs).toHaveLength(1);
    expect(signed.proofs[0].algorithm).toBe('SECP256K1_RFC8785_V1');
    expect(signed.proofs[0].id).toHaveLength(128);
    expect(signed.proofs[0].signature).toMatch(/^[0-9a-f]+$/);
  });

  it('should produce a verifiable signature', async () => {
    const keyPair = generateKeyPair();
    const signed = await signFingerprint(testValue, keyPair.privateKey);
    const proof = signed.proofs[0];

    // Verify using metakit's verifyHash: compute the hash the same way sign() does
    const valueHash = hash(testValue);
    const isValid = await verifyHash(valueHash.value, proof.signature, proof.id);
    expect(isValid).toBe(true);
  });

  it('should produce different signatures for different keys', async () => {
    const key1 = generateKeyPair();
    const key2 = generateKeyPair();

    const sig1 = await signFingerprint(testValue, key1.privateKey);
    const sig2 = await signFingerprint(testValue, key2.privateKey);

    expect(sig1.proofs[0].signature).not.toBe(sig2.proofs[0].signature);
    expect(sig1.proofs[0].id).not.toBe(sig2.proofs[0].id);
  });
});

describe('generateFingerprint', () => {
  it('should produce a complete FingerprintSubmission', async () => {
    const keyPair = generateKeyPair();
    const options: GenerateOptions = {
      orgId: '550e8400-e29b-41d4-a716-446655440000',
      tenantId: '123e4567-e89b-12d3-a456-426614174000',
      eventId: '7ca8c920-0ead-22e2-91c5-11d05fe540d9',
      documentId: 'contract-2024-001',
      documentContent: 'test document content',
    };

    const submission = await generateFingerprint(options, keyPair.privateKey);

    expect(submission.attestation).toBeDefined();
    expect(submission.attestation.content).toBeDefined();
    expect(submission.attestation.proofs).toHaveLength(1);
    expect(submission.attestation.content.signerId).toBe(getPublicKeyId(keyPair.privateKey));
    expect(submission.metadata).toBeUndefined();
  });

  it('should include metadata when includeMetadata is true', async () => {
    const keyPair = generateKeyPair();
    const options: GenerateOptions = {
      orgId: '550e8400-e29b-41d4-a716-446655440000',
      tenantId: '123e4567-e89b-12d3-a456-426614174000',
      eventId: '7ca8c920-0ead-22e2-91c5-11d05fe540d9',
      documentId: 'contract-2024-001',
      documentContent: 'test document content',
      includeMetadata: true,
    };

    const submission = await generateFingerprint(options, keyPair.privateKey);

    expect(submission.metadata).toBeDefined();
    expect(submission.metadata!.hash).toHaveLength(64);
    expect(submission.metadata!.tags).toBeUndefined();
  });

  it('should include metadata with tags when tags provided', async () => {
    const keyPair = generateKeyPair();
    const tags = { department: 'legal', priority: 'high' };
    const options: GenerateOptions = {
      orgId: '550e8400-e29b-41d4-a716-446655440000',
      tenantId: '123e4567-e89b-12d3-a456-426614174000',
      eventId: '7ca8c920-0ead-22e2-91c5-11d05fe540d9',
      documentId: 'contract-2024-001',
      documentContent: 'test document content',
      tags,
    };

    const submission = await generateFingerprint(options, keyPair.privateKey);

    expect(submission.metadata).toBeDefined();
    expect(submission.metadata!.tags).toEqual(tags);
  });
});

describe('FingerprintGenerator', () => {
  it('should generate submissions using stored defaults', async () => {
    const keyPair = generateKeyPair();
    const generator = new FingerprintGenerator({
      privateKey: keyPair.privateKey,
      orgId: '550e8400-e29b-41d4-a716-446655440000',
      tenantId: '123e4567-e89b-12d3-a456-426614174000',
    });

    const submission = await generator.generate({
      eventId: '7ca8c920-0ead-22e2-91c5-11d05fe540d9',
      documentId: 'contract-2024-001',
      documentContent: 'test content',
    });

    expect(submission.attestation.content.orgId).toBe('550e8400-e29b-41d4-a716-446655440000');
    expect(submission.attestation.content.tenantId).toBe('123e4567-e89b-12d3-a456-426614174000');
  });

  it('should expose the public key ID', () => {
    const keyPair = generateKeyPair();
    const generator = new FingerprintGenerator({
      privateKey: keyPair.privateKey,
    });

    expect(generator.getPublicKeyId()).toBe(getPublicKeyId(keyPair.privateKey));
  });
});
