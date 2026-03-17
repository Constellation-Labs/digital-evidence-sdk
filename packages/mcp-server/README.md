# @constellation-network/ded-mcp-server

MCP server for the [Digital Evidence Depository (DED)](https://constellation-main.gitbook.io/digital-evidence) on Constellation Network. Gives any MCP-compatible AI assistant (Claude Desktop, Cursor, Windsurf, VS Code, etc.) the ability to notarize documents, query fingerprints, and verify on-chain proofs.

## Quick start

```bash
# from the repo root
cd packages/mcp-server
npm install
npm run build
```

### Run with the MCP Inspector (interactive web UI)

```bash
npx @modelcontextprotocol/inspector node dist/index.js
```

## Setup

### Claude Code / Claude Desktop

Add to `.mcp.json`, `~/.claude.json`, or `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "ded": {
      "command": "node",
      "args": ["/absolute/path/to/packages/mcp-server/dist/index.js"],
      "env": {
        "DED_API_BASE_URL": "${DED_API_BASE_URL}",
        "DED_API_KEY": "${DED_API_KEY}",
        "DED_SIGNING_PRIVATE_KEY_FILE": "${DED_SIGNING_PRIVATE_KEY_FILE}"
      }
    }
  }
}
```

Or via the CLI:

```bash
claude mcp add ded \
  -e DED_API_BASE_URL="$DED_API_BASE_URL" \
  -e DED_API_KEY="$DED_API_KEY" \
  -e DED_SIGNING_PRIVATE_KEY_FILE="$DED_SIGNING_PRIVATE_KEY_FILE" \
  -- node /absolute/path/to/packages/mcp-server/dist/index.js
```

### Cursor

Add to `.cursor/mcp.json` in your project root:

```json
{
  "mcpServers": {
    "ded": {
      "command": "node",
      "args": ["/absolute/path/to/packages/mcp-server/dist/index.js"],
      "env": {
        "DED_API_BASE_URL": "${DED_API_BASE_URL}",
        "DED_API_KEY": "${DED_API_KEY}",
        "DED_SIGNING_PRIVATE_KEY_FILE": "${DED_SIGNING_PRIVATE_KEY_FILE}"
      }
    }
  }
}
```

### Windsurf

Add to `~/.codeium/windsurf/mcp_config.json`:

```json
{
  "mcpServers": {
    "ded": {
      "command": "node",
      "args": ["/absolute/path/to/packages/mcp-server/dist/index.js"],
      "env": {
        "DED_API_BASE_URL": "${DED_API_BASE_URL}",
        "DED_API_KEY": "${DED_API_KEY}",
        "DED_SIGNING_PRIVATE_KEY_FILE": "${DED_SIGNING_PRIVATE_KEY_FILE}"
      }
    }
  }
}
```

### VS Code (GitHub Copilot)

Add to `.vscode/mcp.json` in your project root:

```json
{
  "servers": {
    "ded": {
      "command": "node",
      "args": ["/absolute/path/to/packages/mcp-server/dist/index.js"],
      "env": {
        "DED_API_BASE_URL": "${DED_API_BASE_URL}",
        "DED_API_KEY": "${DED_API_KEY}",
        "DED_SIGNING_PRIVATE_KEY_FILE": "${DED_SIGNING_PRIVATE_KEY_FILE}"
      }
    }
  }
}
```

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `DED_API_BASE_URL` | No | API base URL (default: `http://localhost:8081`) |
| `DED_API_KEY` | No | API key — enables authenticated tools (search, submit, validate, upload) |
| `DED_SIGNING_PRIVATE_KEY` | No | 64-char hex private key — enables signing tools |
| `DED_SIGNING_PRIVATE_KEY_FILE` | No | Path to a file containing the private key — PEM or raw hex (recommended; use `chmod 600`) |

`DED_SIGNING_PRIVATE_KEY_FILE` takes precedence over `DED_SIGNING_PRIVATE_KEY` if both are set. The file can be either a PEM-encoded EC private key (SEC1 or PKCS#8) or a raw 64-character hex string. PEM is auto-detected and the secp256k1 private key bytes are extracted automatically.

Tools are registered conditionally based on which credentials are provided:

| Configuration | Available tools | Use case |
|---|---|---|
| No credentials | 11 public read-only tools | Browse fingerprints, check statuses, verify proofs |
| + API key | + search, submit, validate, upload | Submit pre-signed fingerprints, search history |
| + Signing key | + sign, prepare, notarize | Full autonomous notarization |

## Tools

### Public tools (no credentials required)

| Tool | Description |
|---|---|
| `ded_get_stats` | Platform-wide fingerprint statistics |
| `ded_get_latest_fingerprints` | Most recent fingerprints with optional pagination |
| `ded_get_fingerprint` | Fetch a fingerprint by its hash |
| `ded_get_fingerprint_proof` | Fetch the Merkle Patricia Trie inclusion proof for a fingerprint |
| `ded_get_batch` | Fetch batch details by ID |
| `ded_get_batch_fingerprints` | List fingerprints in a batch |
| `ded_hash_document` | Compute SHA-256 hash of text content |
| `ded_track_fingerprint` | Human-friendly lifecycle status for a fingerprint |
| `ded_verify_proof` | Verify a fingerprint's MPT inclusion proof against on-chain data |
| `ded_wait_batch_status` | Poll until a batch reaches a terminal status |
| `ded_download_document` | Download a stored document by fingerprint hash |

### Authenticated tools (require `DED_API_KEY`)

| Tool | Description |
|---|---|
| `ded_search_fingerprints` | Search fingerprints by document ID, org, tenant, tags, or date range |
| `ded_submit_fingerprints` | Submit signed fingerprints for on-chain notarization |
| `ded_validate_fingerprints` | Dry-run validation of fingerprint submissions |
| `ded_upload_document` | Upload local files alongside fingerprint submissions (reads from file path) |

### Signing tools (require `DED_SIGNING_PRIVATE_KEY`)

| Tool | Description |
|---|---|
| `ded_sign_fingerprint` | Sign a FingerprintValue using SECP256K1_RFC8785_V1 |
| `ded_prepare_fingerprint` | Hash, sign, and assemble a complete submission from text content or a file path |
| `ded_notarize` | All-in-one for text: hash + sign + submit (also requires `DED_API_KEY`) |
| `ded_notarize_document` | All-in-one for files: reads from file path, hashes raw bytes, signs, and submits (also requires `DED_API_KEY`) |

## Resources

The server exposes static MCP resources with schema documentation:

| Resource URI | Description |
|---|---|
| `ded://schema/fingerprint-value` | JSON Schema for `FingerprintValue` |
| `ded://schema/fingerprint-submission` | JSON Schema for `FingerprintSubmission` |
| `ded://docs/signing-protocol` | SECP256K1_RFC8785_V1 signing protocol documentation |
| `ded://docs/batch-lifecycle` | Batch processing lifecycle and status transitions |
| `ded://tools/signing-script` | Zero-dependency Node.js signing script |
| `ded://docs/document-upload` | Document upload guide (MIME types, size limits, credit costs) |
| `ded://docs/x402-payment` | x402 pay-per-request protocol (alternative to API key subscriptions) |

## Prompts

Guided workflows that chain multiple tools together:

| Prompt | Description |
|---|---|
| `notarize-document` | Hash, sign, submit, and track a document (requires signing key) |
| `verify-document` | Look up a fingerprint and verify its on-chain proof |
| `audit-report` | Generate a summary of recent fingerprinting activity |
| `upload-document` | Upload a local file with a fingerprint (requires signing key + API key) |

## Common workflows

### Notarize a document

The simplest path is the `notarize-document` prompt. Ask your agent:

> Use the notarize-document prompt to notarize my file "contract-v2.pdf" with this content: ...

Or walk through it manually:

1. **Prepare** — `ded_prepare_fingerprint` hashes, signs, and assembles in one call
2. **Submit** — `ded_submit_fingerprints` with the prepared fingerprint exactly as returned
3. **Track** — `ded_track_fingerprint` to monitor until finalized

If you have both an API key and signing key, `ded_notarize` combines all three steps into a single call.

### Verify a fingerprint

> Use the verify-document prompt for hash a1b2c3d4e5f6...

The agent will fetch the fingerprint, verify the MPT inclusion proof against the batch root, and report the on-chain confirmation status.

### Wait for on-chain confirmation

```json
ded_wait_batch_status({ batchId: "batch-uuid", maxWaitSeconds: 60 })
```

Polls every 3 seconds until the batch reaches `FINALIZED_COMMITMENT` or `ERRORED_COMMITMENT`.

## x402 pay-per-request

As an alternative to API key authentication, the DED REST API supports [x402](https://www.x402.org/) pay-per-request payments. This allows callers to submit fingerprints, upload documents, and search without an API key or subscription — paying per request with USDC on Base.

| Feature            | API Key + Subscription | x402 Pay-Per-Request     |
| ---                | ---                    | ---                      |
| Account required   | Yes                    | No                       |
| Billing model      | Monthly subscription   | Per-request USDC payment |
| Org/tenant         | Pre-provisioned        | Auto-created from wallet |
| Upload support     | Paid tiers only        | Always available         |

**Pricing:** 1 credit = $0.01 USD (10,000 atomic USDC)

- Fingerprint submission: 2 credits ($0.02) each
- Document upload: fingerprint credits + 1 credit per 100 KB
- Search query: 1 credit ($0.01)

See the `ded://docs/x402-payment` resource for the full two-step payment flow and client implementation details.

## Architecture

The MCP server uses the [`@constellation-network/digital-evidence-sdk`](../typescript/) for core cryptographic operations (hashing, signing, fingerprint assembly) and maintains its own lightweight API client for the DED HTTP endpoints.
