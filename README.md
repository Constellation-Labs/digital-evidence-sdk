# Digital Evidence SDK

SDK for the Digital Evidence Depository (DED) on Constellation Network. Create, sign, and submit cryptographic fingerprints for document notarization.

Available in **TypeScript** (`@constellation-network/digital-evidence-sdk`) and **Python** (`constellation-digital-evidence-sdk`).

## Architecture

```
digital-evidence-sdk/
├── packages/
│   ├── typescript/     # @constellation-network/digital-evidence-sdk (npm)
│   ├── mcp-server/     # @constellation-network/ded-mcp-server (npm)
│   └── python/         # constellation-digital-evidence-sdk (PyPI)
└── shared/
    └── test_vectors/   # Cross-language test vectors
```

**Core module** (default import) — pure crypto, no network dependencies. Works in browsers, Node.js, serverless.

**Network module** (separate import) — HTTP client for the DED Ingestion API. API-key authenticated endpoints for submission/search, plus public endpoints for lookup and proofs.

**MCP server** (`@constellation-network/ded-mcp-server`) — gives any MCP-compatible AI assistant (Claude, Cursor, Windsurf, VS Code, etc.) the ability to notarize documents, query fingerprints, and verify on-chain proofs. See the [MCP server README](packages/mcp-server/README.md) for setup instructions.

## MCP Server

```bash
npx @constellation-network/ded-mcp-server
```

Add to your MCP config (`.mcp.json`, `.cursor/mcp.json`, etc.):

```json
{
  "mcpServers": {
    "ded": {
      "command": "npx",
      "args": ["-y", "@constellation-network/ded-mcp-server"],
      "env": {
        "DED_API_BASE_URL": "https://your-ded-api.example.com",
        "DED_API_KEY": "your-api-key",
        "DED_SIGNING_PRIVATE_KEY_FILE": "/path/to/private-key"
      }
    }
  }
}
```

## TypeScript

### Install

```bash
npm install @constellation-network/digital-evidence-sdk
```

### Core — Generate and sign a fingerprint

```typescript
import {
  generateFingerprint,
  generateKeyPair,
  hashDocument,
  validateSubmission,
} from '@constellation-network/digital-evidence-sdk';

// Generate a wallet (or use an existing private key)
const keyPair = generateKeyPair();

// Create a signed fingerprint submission
const submission = await generateFingerprint({
  orgId: '550e8400-e29b-41d4-a716-446655440000',
  tenantId: '123e4567-e89b-12d3-a456-426614174000',
  eventId: '7ca8c920-0ead-22e2-91c5-11d05fe540d9',
  documentId: 'contract-2024-001',
  documentContent: 'This is my document content',
  includeMetadata: true,
  tags: { department: 'legal' },
}, keyPair.privateKey);

// Validate before sending
validateSubmission(submission);

console.log(JSON.stringify(submission, null, 2));
```

### Core — Step-by-step signing

```typescript
import {
  createFingerprintValue,
  signFingerprint,
  hashDocument,
  getPublicKeyId,
} from '@constellation-network/digital-evidence-sdk';

// 1. Hash the document
const documentRef = hashDocument('my document content');

// 2. Create the fingerprint value
const value = createFingerprintValue({
  orgId: '550e8400-e29b-41d4-a716-446655440000',
  tenantId: '123e4567-e89b-12d3-a456-426614174000',
  eventId: '7ca8c920-0ead-22e2-91c5-11d05fe540d9',
  documentId: 'contract-2024-001',
  documentRef,
}, getPublicKeyId(privateKey));

// 3. Sign it
const signedFingerprint = await signFingerprint(value, privateKey);

// 4. Package as a submission
const submission = {
  attestation: signedFingerprint,
};
```

### Network — Submit to the DED API

```typescript
import { DedClient } from '@constellation-network/digital-evidence-sdk/network';

const client = new DedClient({
  baseUrl: 'http://localhost:8081',
  apiKey: 'your-api-key',
});

// Submit fingerprints
const results = await client.fingerprints.submit([submission]);

// Search fingerprints (authenticated)
const searchResults = await client.fingerprints.search({
  documentId: 'contract-2024-001',
  limit: 10,
});

// Public endpoints (no API key needed)
const detail = await client.fingerprints.getByHash(hash);
const proof = await client.fingerprints.getProof(hash);
const stats = await client.fingerprints.getStats();
const batch = await client.batches.get(batchId);
```

### FingerprintGenerator — Reuse config across submissions

```typescript
import { FingerprintGenerator } from '@constellation-network/digital-evidence-sdk';

const generator = new FingerprintGenerator({
  privateKey: 'your-private-key',
  orgId: '550e8400-e29b-41d4-a716-446655440000',
  tenantId: '123e4567-e89b-12d3-a456-426614174000',
});

const sub1 = await generator.generate({
  eventId: crypto.randomUUID(),
  documentId: 'doc-001',
  documentContent: 'First document',
});

const sub2 = await generator.generate({
  eventId: crypto.randomUUID(),
  documentId: 'doc-002',
  documentContent: 'Second document',
  tags: { priority: 'high' },
});
```

## Python

### Install

```bash
pip install constellation-digital-evidence-sdk
# For network module:
pip install constellation-digital-evidence-sdk[network]
```

### Core — Generate and sign a fingerprint

```python
from constellation_digital_evidence_sdk import generate_fingerprint, GenerateOptions
from constellation_sdk import generate_key_pair

key_pair = generate_key_pair()

submission = generate_fingerprint(
    GenerateOptions(
        org_id="550e8400-e29b-41d4-a716-446655440000",
        tenant_id="123e4567-e89b-12d3-a456-426614174000",
        event_id="7ca8c920-0ead-22e2-91c5-11d05fe540d9",
        document_id="contract-2024-001",
        document_content="This is my document content",
        include_metadata=True,
        tags={"department": "legal"},
    ),
    key_pair.private_key,
)

print(submission.to_dict())
```

### Network — Submit to the DED API

```python
from constellation_digital_evidence_sdk.network import DedClient, DedClientConfig

async with DedClient(DedClientConfig(
    base_url="http://localhost:8081",
    api_key="your-api-key",
)) as client:
    results = await client.fingerprints.submit([submission])
    detail = await client.fingerprints.get_by_hash(hash_value)
    stats = await client.fingerprints.get_stats()
```

## Signature Protocol

The SDK implements `SECP256K1_RFC8785_V1`:

1. Canonicalize JSON per RFC 8785
2. SHA-256 hash the canonical bytes
3. Convert hash to hex string, treat as UTF-8 bytes
4. SHA-512 hash, truncate to 32 bytes
5. Sign with SECP256K1 ECDSA

## Development

```bash
git clone https://github.com/Constellation-Labs/digital-evidence-sdk.git
cd digital-evidence-sdk

# TypeScript
cd packages/typescript
npm install
npm test
npm run build

# Python
cd packages/python
python3 -m venv .venv
.venv/bin/pip install -e ".[dev]"
.venv/bin/pytest tests/ -v
```

## License

Apache-2.0
