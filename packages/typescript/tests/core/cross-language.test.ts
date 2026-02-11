import * as path from 'path';
import * as fs from 'fs';
import { signFingerprint } from '../../src/core/fingerprint';
import { computeMetadataHash, createMetadata } from '../../src/core/metadata';
import { hashDocument } from '../../src/core/document';
import {
  canonicalize,
  getPublicKeyId,
  verifyHash,
  hash,
} from '@constellation-network/metagraph-sdk';
import type { FingerprintValue } from '../../src/core/types';

const vectorsPath = path.resolve(
  __dirname,
  '../../../../shared/test_vectors/fingerprint_vectors.json'
);
const vectors = JSON.parse(fs.readFileSync(vectorsPath, 'utf-8'));

describe('cross-language test vectors', () => {
  const basicVector = vectors.vectors.find(
    (v: { name: string }) => v.name === 'basic_fingerprint_submission'
  );
  const signerVector = vectors.vectors.find(
    (v: { name: string }) => v.name === 'fingerprint_with_signer_id'
  );
  const metadataVector = vectors.vectors.find(
    (v: { name: string }) => v.name === 'fingerprint_with_metadata'
  );

  it('should produce the expected document content hash', () => {
    const result = hashDocument(basicVector.documentContent);
    expect(result).toBe(basicVector.documentContentHash);
  });

  it('should canonicalize with fields in expected order (no signerId)', () => {
    const value: FingerprintValue = basicVector.fingerprintValue;
    const canonical = canonicalize(value);
    const parsed = JSON.parse(canonical);
    const keys = Object.keys(parsed);
    expect(keys).toEqual(basicVector.expectedCanonicalFields);
  });

  it('should canonicalize with signerId in expected position', () => {
    const publicKeyId = getPublicKeyId(signerVector.privateKey);
    const value: FingerprintValue = {
      ...signerVector.fingerprintValue,
      signerId: publicKeyId,
    };
    const canonical = canonicalize(value);
    const parsed = JSON.parse(canonical);
    const keys = Object.keys(parsed);
    expect(keys).toEqual(signerVector.expectedCanonicalFields);
  });

  it('should produce a verifiable signature from test vector', async () => {
    const value: FingerprintValue = basicVector.fingerprintValue;
    const signed = await signFingerprint(value, basicVector.privateKey);

    expect(signed.content).toEqual(value);
    expect(signed.proofs).toHaveLength(1);
    expect(signed.proofs[0].algorithm).toBe('SECP256K1_RFC8785_V1');

    // Verify the signature
    const valueHash = hash(value);
    const isValid = await verifyHash(
      valueHash.value,
      signed.proofs[0].signature,
      signed.proofs[0].id
    );
    expect(isValid).toBe(true);
  });

  it('should compute metadata hash deterministically', () => {
    const value: FingerprintValue = metadataVector.fingerprintValue;
    const hash1 = computeMetadataHash(value);
    const hash2 = computeMetadataHash(value);
    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64);
    expect(hash1).toMatch(/^[0-9a-f]+$/);
  });

  it('should create metadata with tags from vector', () => {
    const value: FingerprintValue = metadataVector.fingerprintValue;
    const metadata = createMetadata(value, metadataVector.tags);
    expect(metadata.hash).toHaveLength(64);
    expect(metadata.tags).toEqual(metadataVector.tags);
  });
});
