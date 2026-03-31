# Digital Evidence SDK — x402 Micropayment Extension

[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)

x402 micropayment extension for the Digital Evidence SDK on Constellation Network. Submit cryptographic fingerprints and pay per request using an Ethereum wallet — no API key or registration required.

## How it works

Instead of authenticating with an API key, these packages use the [x402 protocol](https://www.x402.org/) to pay for each request with USDC via EIP-3009 TransferWithAuthorization. The flow is transparent:

1. SDK sends a request to the DED API
2. Server responds with `402 Payment Required` and a price
3. SDK signs an EIP-3009 payment with your Ethereum wallet
4. SDK retries the request with the signed payment
5. Server verifies, settles, and processes the request

Your organization and tenant IDs are deterministically derived from your wallet address (UUID v5), so no prior registration is needed.

## Packages

| Package | Language | Install |
|---------|----------|---------|
| `digital-evidence-sdk-x402` | Python | `pip install digital-evidence-sdk-x402` |
| `@constellation-network/digital-evidence-sdk-x402` | TypeScript | `npm install @constellation-network/digital-evidence-sdk-x402` |

Both packages expose the same API surface as their base SDKs but replace API key auth with x402 payments.

---

## Python

### Install

```bash
pip install digital-evidence-sdk-x402
```

This installs the base SDK (`constellation-digital-evidence-sdk`) and `eth-account` for EIP-712 signing.

### Quick start

```python
from digital_evidence_sdk_x402 import (
    DedX402Client,
    X402Config,
    GenerateOptions,
)

async with DedX402Client(X402Config(
    base_url="https://de-api.constellationnetwork.io",
    wallet_private_key="0x...",   # Ethereum key (for x402 payments)
    signing_private_key="...",    # DAG/SECP256K1 key (for fingerprint signing)
)) as client:
    # Generate a fingerprint — org_id and tenant_id are auto-derived from wallet
    submission = client.generate_fingerprint(GenerateOptions(
        org_id="",
        tenant_id="",
        event_id="evt-001",
        document_id="contract-2024-001",
        document_content="This is my document content",
        include_metadata=True,
        tags={"department": "legal"},
    ))

    # Submit (x402 payment handled automatically)
    results = await client.fingerprints.submit([submission])

    # Public endpoints (free, no payment)
    detail = await client.fingerprints.get_by_hash(hash_value)
    proof = await client.fingerprints.get_proof(hash_value)
    stats = await client.fingerprints.get_stats()
```

### Manual payment control

Set `auto_pay=False` to inspect the price before paying:

```python
from digital_evidence_sdk_x402 import DedX402Client, X402Config

client = DedX402Client(X402Config(
    base_url="https://de-api.constellationnetwork.io",
    wallet_private_key="0x...",
    auto_pay=False,
))

result = await client.fingerprints.submit([submission])

if result.kind == "payment_required":
    offer = result.payment.accepts[0]
    print(f"Cost: {offer.amount} atomic USDC on {offer.network}")
    print(f"Pay to: {offer.pay_to}")
    # Re-submit with auto_pay=True, or sign manually
elif result.kind == "result":
    print(f"Submitted: {result.data}")
```

### Custom signer

Implement the `X402Signer` protocol to use hardware wallets, KMS, or other backends:

```python
from digital_evidence_sdk_x402 import X402Signer, DedX402Client, X402Config

class MyKmsSigner:
    @property
    def address(self) -> str:
        return "0x..."

    async def sign_typed_data(self, domain, types, message) -> str:
        return await my_kms.sign_eip712(domain, types, message)

client = DedX402Client(
    X402Config(base_url="...", wallet_private_key=""),
    signer=MyKmsSigner(),
)
```

---

## TypeScript

### Install

```bash
npm install @constellation-network/digital-evidence-sdk-x402
```

ethers.js v6 is an optional peer dependency, needed only for `createEthersSigner()`.

### Quick start

```typescript
import { ethers } from 'ethers';
import {
  DedX402Client,
  createEthersSigner,
} from '@constellation-network/digital-evidence-sdk-x402';

const wallet = new ethers.Wallet(process.env.ETH_PRIVATE_KEY!);

const client = new DedX402Client({
  baseUrl: 'https://de-api.constellationnetwork.io',
  signer: createEthersSigner(wallet),
  signingPrivateKey: process.env.DAG_PRIVATE_KEY!, // DAG/SECP256K1 key
});

// Generate a fingerprint — orgId and tenantId are auto-derived from wallet
const submission = await client.generateFingerprint({
  eventId: 'evt-001',
  documentId: 'contract-2024-001',
  documentContent: 'This is my document content',
  includeMetadata: true,
  tags: { department: 'legal' },
});

// Submit (x402 payment handled automatically)
const results = await client.fingerprints.submit([submission]);

// Public endpoints (free, no payment)
const detail = await client.fingerprints.getByHash(hash);
const proof = await client.fingerprints.getProof(hash);
const stats = await client.fingerprints.getStats();
```

### Manual payment control

Set `autoPay: false` to inspect the price before paying:

```typescript
const client = new DedX402Client({
  baseUrl: 'https://de-api.constellationnetwork.io',
  signer: createEthersSigner(wallet),
  autoPay: false,
});

const result = await client.fingerprints.submit([submission]);

if (result.kind === 'payment_required') {
  const offer = result.payment.accepts[0];
  console.log(`Cost: ${offer.amount} atomic USDC on ${offer.network}`);
  console.log(`Pay to: ${offer.payTo}`);
} else {
  console.log('Submitted:', result.data);
}
```

### Custom signer

Implement the `X402Signer` interface for KMS, Ledger, or other backends:

```typescript
import type { X402Signer } from '@constellation-network/digital-evidence-sdk-x402';

const kmsSigner: X402Signer = {
  get address() { return '0x...'; },
  async signTypedData(domain, types, value) {
    return await myKms.signEip712(domain, types, value);
  },
};

const client = new DedX402Client({
  baseUrl: '...',
  signer: kmsSigner,
});
```

---

## API reference

### Paid endpoints (x402)

| Method | Description |
|--------|-------------|
| `fingerprints.submit(submissions)` | Submit fingerprints for notarization |
| `fingerprints.upload(submissions, documents)` | Upload fingerprints with documents |
| `fingerprints.search(params)` | Search fingerprints with filtering |
| `generateFingerprint(options)` | Generate a submission with wallet-derived org/tenant IDs |

### Public endpoints (free)

| Method | Description |
|--------|-------------|
| `fingerprints.getByHash(hash)` | Look up a fingerprint by hash |
| `fingerprints.getProof(hash)` | Get Merkle inclusion proof |
| `fingerprints.getLatest(limit, status)` | Get latest fingerprints |
| `fingerprints.getStats()` | Get platform statistics |
| `batches.get(batchId)` | Get batch details |
| `batches.getFingerprints(batchId)` | Get fingerprints in a batch |

### Client properties

| Property | Description |
|----------|-------------|
| `orgId` | Deterministic org UUID derived from wallet address |
| `tenantId` | Deterministic tenant UUID derived from wallet address |
| `walletAddress` | Ethereum wallet address used for payments |

## x402 payment details

- **Protocol**: [x402 v2](https://www.x402.org/)
- **Payment method**: EIP-3009 TransferWithAuthorization (USDC)
- **Signing**: EIP-712 typed structured data
- **Networks**: Base Sepolia (testnet), Base (mainnet)
- **Pricing**: 2 credits per fingerprint, 1 credit per 100KB document storage
- **Wallet-to-org mapping**: UUID v5 derivation from Ethereum address (deterministic, no registration)

## Development

```bash
# Python
cd packages/python-x402
python3 -m venv .venv
.venv/bin/pip install -e "../python[network]" -e ".[dev]"
.venv/bin/pytest tests/ -v

# TypeScript
cd packages/typescript-x402
npm install
npm test
npm run build
```

## License

[Apache-2.0](LICENSE)
