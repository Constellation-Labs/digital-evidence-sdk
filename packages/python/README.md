# constellation-digital-evidence-sdk

[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](../../LICENSE)

Python SDK for the Digital Evidence Depository on Constellation Network. Create, sign, and submit cryptographic fingerprints for document notarization.

## Install

```bash
pip install constellation-digital-evidence-sdk

# With network module:
pip install constellation-digital-evidence-sdk[network]
```

## Modules

**Core** (default import) — pure cryptographic operations with no network dependencies.

**Network** (optional extra) — async HTTP client for the Digital Evidence Ingestion API. Requires `httpx`.

```python
# Core — always available
from constellation_digital_evidence_sdk import generate_fingerprint, GenerateOptions

# Network — requires [network] extra
from constellation_digital_evidence_sdk.network import DedClient, DedClientConfig
```

## Usage

### Generate a signed fingerprint

```python
from constellation_digital_evidence_sdk import (
    generate_fingerprint,
    GenerateOptions,
    validate_submission,
)
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

validate_submission(submission)
```

### Submit to the API

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

## Core API

| Export | Description |
|--------|-------------|
| `generate_fingerprint` | Create, sign, and package a fingerprint in one call |
| `create_fingerprint_value` | Build the fingerprint value object |
| `sign_fingerprint` | Sign a fingerprint value with a private key |
| `hash_document` | SHA-256 hash a document (string or bytes) |
| `validate_submission` | Validate a submission |
| `FingerprintGenerator` | Reusable generator with stored config |
| `compute_metadata_hash` | Compute deterministic metadata hash |
| `create_metadata` | Create metadata with optional tags |

## Signature Protocol

The SDK implements `SECP256K1_RFC8785_V1`:

1. Canonicalize JSON per RFC 8785
2. SHA-256 hash the canonical bytes
3. Convert hash to hex string, treat as UTF-8 bytes
4. SHA-512 hash, truncate to 32 bytes
5. Sign with SECP256K1 ECDSA

## Development

```bash
python3 -m venv .venv
.venv/bin/pip install -e ".[dev]"
.venv/bin/pytest tests/ -v
```

## License

[Apache-2.0](../../LICENSE)
