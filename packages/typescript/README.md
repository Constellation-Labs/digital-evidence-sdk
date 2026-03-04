# @constellation-network/digital-evidence-sdk

[![npm](https://img.shields.io/npm/v/@constellation-network/digital-evidence-sdk)](https://www.npmjs.com/package/@constellation-network/digital-evidence-sdk)
[![CI](https://github.com/Constellation-Labs/digital-evidence-sdk/actions/workflows/ci.yml/badge.svg)](https://github.com/Constellation-Labs/digital-evidence-sdk/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](../../LICENSE)

TypeScript SDK for the Digital Evidence Depository on Constellation Network. Create, sign, and submit cryptographic fingerprints for document notarization.

## Install

```bash
npm install @constellation-network/digital-evidence-sdk
```

## Modules

**Core** (default import) — pure cryptographic operations with no network dependencies. Works in browsers, Node.js, and serverless environments.

**Network** (subpath import) — HTTP client for the Digital Evidence Ingestion API. Provides authenticated endpoints for submission and search, plus public endpoints for lookup and proofs.

```typescript
// Core — always available
import { generateFingerprint, generateKeyPair } from '@constellation-network/digital-evidence-sdk';

// Network — optional, import separately
import { DedClient } from '@constellation-network/digital-evidence-sdk/network';
```

## Usage

### Generate a signed fingerprint

```typescript
import {
  generateFingerprint,
  generateKeyPair,
  validateSubmission,
} from '@constellation-network/digital-evidence-sdk';

const keyPair = generateKeyPair();

const submission = await generateFingerprint({
  orgId: '550e8400-e29b-41d4-a716-446655440000',
  tenantId: '123e4567-e89b-12d3-a456-426614174000',
  eventId: '7ca8c920-0ead-22e2-91c5-11d05fe540d9',
  documentId: 'contract-2024-001',
  documentContent: 'This is my document content',
  includeMetadata: true,
  tags: { department: 'legal' },
}, keyPair.privateKey);

validateSubmission(submission);
```

### Step-by-step signing

```typescript
import {
  createFingerprintValue,
  signFingerprint,
  hashDocument,
  getPublicKeyId,
} from '@constellation-network/digital-evidence-sdk';

const documentRef = hashDocument('my document content');

const value = createFingerprintValue({
  orgId: '550e8400-e29b-41d4-a716-446655440000',
  tenantId: '123e4567-e89b-12d3-a456-426614174000',
  eventId: '7ca8c920-0ead-22e2-91c5-11d05fe540d9',
  documentId: 'contract-2024-001',
  documentRef,
}, getPublicKeyId(privateKey));

const signedFingerprint = await signFingerprint(value, privateKey);
```

### Reusable generator

```typescript
import { FingerprintGenerator } from '@constellation-network/digital-evidence-sdk';

const generator = new FingerprintGenerator({
  privateKey: 'your-private-key',
  orgId: '550e8400-e29b-41d4-a716-446655440000',
  tenantId: '123e4567-e89b-12d3-a456-426614174000',
});

const submission = await generator.generate({
  eventId: crypto.randomUUID(),
  documentId: 'doc-001',
  documentContent: 'Document content',
  tags: { priority: 'high' },
});
```

### Submit to the API

```typescript
import { DedClient } from '@constellation-network/digital-evidence-sdk/network';

const client = new DedClient({
  baseUrl: 'http://localhost:8081',
  apiKey: 'your-api-key',
});

// Authenticated
const results = await client.fingerprints.submit([submission]);
const search = await client.fingerprints.search({ documentId: 'contract-2024-001' });

// Public (no API key required)
const detail = await client.fingerprints.getByHash(hash);
const proof = await client.fingerprints.getProof(hash);
const stats = await client.fingerprints.getStats();
```

## Core API

| Export | Description |
|--------|-------------|
| `generateFingerprint` | Create, sign, and package a fingerprint in one call |
| `createFingerprintValue` | Build the fingerprint value object |
| `signFingerprint` | Sign a fingerprint value with a private key |
| `hashDocument` | SHA-256 hash a document (string or bytes) |
| `validateSubmission` | Validate a submission against the schema (throws on error) |
| `safeValidateSubmission` | Validate without throwing, returns result object |
| `FingerprintGenerator` | Reusable generator with stored config |
| `generateKeyPair` | Generate a new SECP256K1 key pair |
| `keyPairFromPrivateKey` | Derive a key pair from an existing private key |

## Signature Protocol

The SDK implements `SECP256K1_RFC8785_V1`:

1. Canonicalize JSON per RFC 8785
2. SHA-256 hash the canonical bytes
3. Convert hash to hex string, treat as UTF-8 bytes
4. SHA-512 hash, truncate to 32 bytes
5. Sign with SECP256K1 ECDSA

## Development

```bash
npm install
npm test
npm run build
npm run lint
```

## License

[Apache-2.0](../../LICENSE)
