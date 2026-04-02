# constellation-digital-evidence-sdk-x402

[![PyPI](https://img.shields.io/pypi/v/constellation-digital-evidence-sdk-x402)](https://pypi.org/project/constellation-digital-evidence-sdk-x402/)
[![CI](https://github.com/Constellation-Labs/digital-evidence-sdk/actions/workflows/ci.yml/badge.svg)](https://github.com/Constellation-Labs/digital-evidence-sdk/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](../../LICENSE)

x402 micropayment extension for the Digital Evidence Depository SDK. Pay-per-request fingerprint submission using USDC on **Base** via an Ethereum wallet — no API key required.

For full documentation including payment control, custom signers, and pricing, see the [x402 Payments guide](https://docs.constellationnetwork.io/sdk/digital-evidence/x402-payments).

## Install

```bash
pip install constellation-digital-evidence-sdk-x402
```

This installs the base SDK (`constellation-digital-evidence-sdk`) and `eth-account` for EIP-712 signing.

## Quick start

```python
import asyncio
import uuid

from constellation_digital_evidence_sdk_x402 import (
    DedX402Client,
    X402Config,
    GenerateOptions,
)


async def main():
    async with DedX402Client(X402Config(
            base_url="https://de-api.constellationnetwork.io",
            wallet_private_key="0x...",   # Ethereum key (for x402 payments)
            signing_private_key="...",    # DAG/SECP256K1 key (for fingerprint signing)
    )) as client:
        # Generate a fingerprint — org_id and tenant_id are auto-derived from wallet
        submission = client.generate_fingerprint(GenerateOptions(
            org_id="",
            tenant_id="",
            event_id=str(uuid.uuid4()),
            document_id="contract-2024-001",
            document_content="This is my document content",
            include_metadata=True,
            tags={"department": "legal"},
        ))

        print("Submission:", submission)

        # Submit (x402 payment handled automatically)
        results = await client.fingerprints.submit([submission])
        print("Results:", results)

        # Public endpoints (free, no payment)
        hash_value = results.data[0]["hash"]
        detail = await client.fingerprints.get_by_hash(hash_value)
        print("Detail:", detail)
        stats = await client.fingerprints.get_stats()
        print("Stats:", stats)
        # proof = await client.fingerprints.get_proof(hash_value)  # available after batch commit

asyncio.run(main())

```

## How it works

The client uses the [x402 protocol](https://www.x402.org/) to handle payments transparently. When the API responds with `402 Payment Required`, the client signs an EIP-3009 `TransferWithAuthorization` using your Ethereum wallet and retries the request with the payment header attached.

Organization and tenant IDs are deterministically derived from your wallet address (UUID v5), so no prior registration is needed.

## Configuration

```python
from constellation_digital_evidence_sdk_x402 import DedX402Client, X402Config

client = DedX402Client(X402Config(
    base_url="https://de-api.constellationnetwork.io",
    wallet_private_key="0x...",  # Ethereum key for x402 payments
    signing_private_key="...",   # DAG/SECP256K1 key for fingerprint signing (optional)
    auto_pay=True,               # Auto-pay on 402 responses (default: True)
    timeout=30.0,                # Request timeout in seconds (default: 30.0)
))
```

When `auto_pay=False`, paid endpoints return a `PaymentRequired` result instead of paying automatically, allowing caller-driven payment flows:

```python
result = await client.fingerprints.submit([submission])

if result.kind == "payment_required":
    offer = result.payment.accepts[0]
    print(f"Cost: {offer.amount} atomic USDC on {offer.network}")
    print(f"Pay to: {offer.pay_to}")

    # Sign an EIP-3009 TransferWithAuthorization for the offer
    # (see x402 payments guide for full signing details)
    payment_header = sign_x402_payment(wallet_private_key, offer)  # base64-encoded

    # Retry the request with the signed payment header
    async with httpx.AsyncClient() as http:
        response = await http.post(
            f"{base_url}/v1/fingerprints",
            headers={
                "Content-Type": "application/json",
                "X-PAYMENT": payment_header,
            },
            content=json.dumps([submission.to_dict()]),
        )
    print("Submitted:", response.json())

elif result.kind == "result":
    print(f"Submitted: {result.data}")
```

## Custom signer

Implement the `X402Signer` protocol to use hardware wallets, KMS, or other backends:

```python
from constellation_digital_evidence_sdk_x402 import X402Signer, DedX402Client, X402Config

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

## API

### Client

| Property / Method | Description |
|---|---|
| `client.fingerprints` | Fingerprint API (submit, search, upload) |
| `client.batches` | Batch status API |
| `client.generate_fingerprint(opts)` | Generate a signed fingerprint (requires `signing_private_key`) |
| `client.org_id` | Deterministic org UUID from wallet |
| `client.tenant_id` | Deterministic tenant UUID from wallet |
| `client.wallet_address` | Ethereum wallet address |

### Fingerprints

| Method | Payment | Description |
|---|---|---|
| `submit(submissions)` | Paid | Submit fingerprints for notarization |
| `submit_in_batches(submissions, batch_size, delay_ms)` | Paid | Submit in batches (separate payment per batch) |
| `upload(submissions, documents)` | Paid | Upload fingerprints with documents (multipart) |
| `search(params)` | Paid | Search fingerprints with filtering and pagination |
| `get_by_hash(hash)` | Public | Get fingerprint detail by hash |
| `get_proof(hash)` | Public | Get Merkle inclusion proof |
| `get_latest(limit, status)` | Public | Get latest fingerprints |
| `get_stats()` | Public | Get platform-wide statistics |

## Development

```bash
python3 -m venv .venv
.venv/bin/pip install -e "../python[network]" -e ".[dev]"
.venv/bin/pytest tests/ -v
```

## License

[Apache-2.0](../../LICENSE)