# @constellation-network/digital-evidence-sdk-x402

[![npm](https://img.shields.io/npm/v/@constellation-network/digital-evidence-sdk-x402)](https://www.npmjs.com/package/@constellation-network/digital-evidence-sdk-x402)
[![CI](https://github.com/Constellation-Labs/digital-evidence-sdk/actions/workflows/ci.yml/badge.svg)](https://github.com/Constellation-Labs/digital-evidence-sdk/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](../../LICENSE)

x402 micropayment extension for the Digital Evidence Depository SDK. Pay-per-request fingerprint submission using USDC on **Base** via an Ethereum wallet — no API key required.

For full documentation including payment control, custom signers, and pricing, see the [x402 Payments guide](https://docs.constellationnetwork.io/sdk/digital-evidence/x402-payments).

## Install

```bash
npm install @constellation-network/digital-evidence-sdk-x402 ethers
```

## Quick start

```typescript
import { ethers } from 'ethers';
import { DedX402Client, createEthersSigner } from '@constellation-network/digital-evidence-sdk-x402';

const wallet = new ethers.Wallet(process.env.ETH_PRIVATE_KEY!);
const client = new DedX402Client({
  baseUrl: 'https://de-api.constellationnetwork.io',
  signer: createEthersSigner(wallet),
  signingPrivateKey: process.env.DAG_PRIVATE_KEY!,
});

// Generate a fingerprint (org/tenant IDs derived from wallet)
const submission = await client.generateFingerprint({
  eventId: crypto.randomUUID(),
  documentId: 'doc-001',
  documentContent: 'Hello, world!',
});

// Submit — payment is handled automatically
const results = await client.fingerprints.submit([submission]);
```

## How it works

The client uses the [x402 protocol](https://www.x402.org/) to handle payments transparently. When the API responds with `402 Payment Required`, the client signs an EIP-3009 `TransferWithAuthorization` using your Ethereum wallet and retries the request with the payment header attached.

Organization and tenant IDs are deterministically derived from your wallet address (UUID v5), so no prior registration is needed.

## Configuration

```typescript
const client = new DedX402Client({
  baseUrl: 'https://de-api.constellationnetwork.io',
  signer: createEthersSigner(wallet),
  signingPrivateKey: '...',  // DAG/SECP256K1 key for fingerprint signing (optional)
  autoPay: true,             // Auto-pay on 402 responses (default: true)
  timeout: 30000,            // Request timeout in ms (default: 30000)
});
```

When `autoPay` is `false`, paid endpoints return a `PaymentRequiredResult` instead of paying automatically, allowing caller-driven payment flows.

## API

### Client

| Property / Method | Description |
|---|---|
| `client.fingerprints` | Fingerprint API (submit, search, upload) |
| `client.batches` | Batch status API |
| `client.generateFingerprint(opts)` | Generate a signed fingerprint (requires `signingPrivateKey`) |
| `client.orgId` | Deterministic org UUID from wallet |
| `client.tenantId` | Deterministic tenant UUID from wallet |
| `client.walletAddress` | Ethereum wallet address |

### Fingerprints

| Method | Payment | Description |
|---|---|---|
| `submit(submissions)` | Paid | Submit fingerprints for notarization |
| `submitInBatches(submissions, batchSize?, delayMs?)` | Paid | Submit in batches (separate payment per batch) |
| `upload(submissions, documents)` | Paid | Upload fingerprints with documents (multipart) |
| `search(params)` | Paid | Search fingerprints with filtering and pagination |
| `getByHash(hash)` | Public | Get fingerprint detail by hash |
| `getProof(hash)` | Public | Get Merkle inclusion proof |
| `getLatest(limit?, status?)` | Public | Get latest fingerprints |
| `getStats()` | Public | Get platform-wide statistics |

## Development

```bash
npm install
npm test
npm run build
npm run lint
```

## License

[Apache-2.0](../../LICENSE)