#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { loadConfig } from "./config.js";
import { DedApiClient } from "./api-client.js";
import * as getStats from "./tools/get-stats.js";
import * as getLatest from "./tools/get-latest.js";
import * as getFingerprint from "./tools/get-fingerprint.js";
import * as getFingerprintProof from "./tools/get-fingerprint-proof.js";
import * as getBatch from "./tools/get-batch.js";
import * as getBatchFingerprints from "./tools/get-batch-fingerprints.js";
import * as searchFingerprints from "./tools/search-fingerprints.js";
import * as submitFingerprints from "./tools/submit-fingerprints.js";
import * as validateFingerprints from "./tools/validate-fingerprints.js";
import * as signFingerprint from "./tools/sign-fingerprint.js";
import * as hashDocument from "./tools/hash-document.js";
import * as prepareFingerprint from "./tools/prepare-fingerprint.js";
import * as notarize from "./tools/notarize.js";
import * as trackFingerprint from "./tools/track-fingerprint.js";
import * as verifyProof from "./tools/verify-proof.js";
import * as waitBatchStatus from "./tools/wait-batch-status.js";
import * as downloadDocument from "./tools/download-document.js";
import * as uploadDocument from "./tools/upload-document.js";
const config = loadConfig();
const client = new DedApiClient(config);
const server = new McpServer({
    name: "ded-fingerprint-services",
    version: "0.1.0",
});
// ── Public tools (no auth required) ──────────────────────────────────
server.tool(getStats.name, getStats.description, getStats.inputSchema.shape, getStats.register(client));
server.tool(getLatest.name, getLatest.description, getLatest.inputSchema.shape, getLatest.register(client));
server.tool(getFingerprint.name, getFingerprint.description, getFingerprint.inputSchema.shape, getFingerprint.register(client));
server.tool(getFingerprintProof.name, getFingerprintProof.description, getFingerprintProof.inputSchema.shape, getFingerprintProof.register(client));
server.tool(getBatch.name, getBatch.description, getBatch.inputSchema.shape, getBatch.register(client));
server.tool(getBatchFingerprints.name, getBatchFingerprints.description, getBatchFingerprints.inputSchema.shape, getBatchFingerprints.register(client));
server.tool(hashDocument.name, hashDocument.description, hashDocument.inputSchema.shape, hashDocument.register());
server.tool(trackFingerprint.name, trackFingerprint.description, trackFingerprint.inputSchema.shape, trackFingerprint.register(client));
server.tool(verifyProof.name, verifyProof.description, verifyProof.inputSchema.shape, verifyProof.register(client));
server.tool(waitBatchStatus.name, waitBatchStatus.description, waitBatchStatus.inputSchema.shape, waitBatchStatus.register(client));
server.tool(downloadDocument.name, downloadDocument.description, downloadDocument.inputSchema.shape, downloadDocument.register(client));
// ── Authenticated tools (require API key) ────────────────────────────
if (config.apiKey) {
    server.tool(searchFingerprints.name, searchFingerprints.description, searchFingerprints.inputSchema.shape, searchFingerprints.register(client));
    server.tool(submitFingerprints.name, submitFingerprints.description, submitFingerprints.inputSchema.shape, submitFingerprints.register(client));
    server.tool(validateFingerprints.name, validateFingerprints.description, validateFingerprints.inputSchema.shape, validateFingerprints.register(client));
    server.tool(uploadDocument.name, uploadDocument.description, uploadDocument.inputSchema.shape, uploadDocument.register(client));
}
// ── Local-only signing tools (require private key) ───────────────────
if (config.signingPrivateKey) {
    server.tool(signFingerprint.name, signFingerprint.description, signFingerprint.inputSchema.shape, signFingerprint.register(config.signingPrivateKey));
    server.tool(prepareFingerprint.name, prepareFingerprint.description, prepareFingerprint.inputSchema.shape, prepareFingerprint.register(config.signingPrivateKey));
    if (config.apiKey) {
        server.tool(notarize.name, notarize.description, notarize.inputSchema.shape, notarize.register(config.signingPrivateKey, client));
    }
}
// ── MCP Resources (static context) ──────────────────────────────────
server.resource("fingerprint-value-schema", "ded://schema/fingerprint-value", {
    description: "JSON Schema for FingerprintValue — the core fields required in every fingerprint submission",
    mimeType: "application/json",
}, async (uri) => ({
    contents: [
        {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify({
                type: "object",
                required: ["orgId", "tenantId", "eventId", "documentId", "documentRef", "timestamp", "version"],
                properties: {
                    orgId: { type: "string", format: "uuid", description: "Organization UUID (assigned by DED platform)" },
                    tenantId: { type: "string", format: "uuid", description: "Tenant UUID (assigned by organization)" },
                    eventId: { type: "string", format: "uuid", description: "Unique event identifier (client-generated UUIDv4)" },
                    signerId: { type: "string", pattern: "^[0-9a-fA-F]+$", minLength: 64, maxLength: 140, description: "Optional public key in hex (no 0x prefix)" },
                    documentId: { type: "string", minLength: 1, maxLength: 256, description: "Document identifier" },
                    documentRef: { type: "string", pattern: "^[0-9a-fA-F]+$", minLength: 32, maxLength: 128, description: "Hex-encoded hash of document content" },
                    timestamp: { type: "string", format: "date-time", description: "RFC 3339 timestamp (e.g. 2025-01-15T10:30:00Z)" },
                    version: { type: "integer", minimum: 1, description: "Schema version (must be >= 1)" },
                },
            }, null, 2),
        },
    ],
}));
server.resource("fingerprint-submission-schema", "ded://schema/fingerprint-submission", {
    description: "JSON Schema for a complete FingerprintSubmission — the protobuf-JSON format accepted by ded_submit_fingerprints",
    mimeType: "application/json",
}, async (uri) => ({
    contents: [
        {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify({
                type: "object",
                required: ["attestation"],
                properties: {
                    attestation: {
                        type: "object",
                        description: "SignedFingerprint — contains the fingerprint value and its cryptographic proofs",
                        required: ["content", "proofs"],
                        properties: {
                            content: {
                                type: "object",
                                description: "FingerprintValue — see ded://schema/fingerprint-value for field details",
                                required: ["orgId", "tenantId", "eventId", "documentId", "documentRef", "timestamp", "version"],
                            },
                            proofs: {
                                type: "array",
                                description: "Cryptographic signatures over the content",
                                minItems: 1,
                                items: {
                                    type: "object",
                                    required: ["id", "signature", "algorithm"],
                                    properties: {
                                        id: { type: "string", pattern: "^[0-9a-fA-F]+$", minLength: 1, maxLength: 140, description: "Uncompressed public key hex (no 0x04 prefix)" },
                                        signature: { type: "string", pattern: "^[0-9a-fA-F]+$", minLength: 64, maxLength: 2048, description: "ECDSA signature as hex string" },
                                        algorithm: { type: "string", enum: ["SECP256K1_RFC8785_V1"], description: "Signing algorithm" },
                                    },
                                },
                            },
                        },
                    },
                    metadata: {
                        type: "object",
                        properties: {
                            hash: { type: "string", pattern: "^[0-9a-fA-F]+$", minLength: 32, maxLength: 128, description: "Hex-encoded hash of the FingerprintValue" },
                            tags: { type: "object", maxProperties: 6, additionalProperties: { type: "string", maxLength: 32 }, description: "Key-value metadata tags (max 6 pairs, keys max 32 chars)" },
                        },
                    },
                },
            }, null, 2),
        },
    ],
}));
server.resource("signing-protocol-docs", "ded://docs/signing-protocol", {
    description: "Documentation for the SECP256K1_RFC8785_V1 signing protocol used by DED",
    mimeType: "text/plain",
}, async (uri) => ({
    contents: [
        {
            uri: uri.href,
            mimeType: "text/plain",
            text: [
                "DED Signing Protocol: SECP256K1_RFC8785_V1",
                "============================================",
                "",
                "This protocol signs FingerprintValue objects using ECDSA with the secp256k1 curve.",
                "",
                "Steps:",
                "1. CANONICALIZE: Convert the FingerprintValue JSON to RFC 8785 canonical form",
                "   - Deterministic key ordering, minimal whitespace, Unicode normalization",
                "2. SHA-256 HASH: Hash the canonical JSON bytes (UTF-8 encoded) with SHA-256",
                "   - Result: 64-character hex string",
                "3. HEX-TO-BYTES: Treat the hex string as a UTF-8 string and get its bytes",
                "   - This is NOT hex-decoding — it's treating the hex characters as literal text",
                "4. SHA-512 + TRUNCATE: SHA-512 hash those bytes, then take the first 32 bytes",
                "   - This produces the final message digest for signing",
                "5. ECDSA SIGN: Sign the 32-byte digest with the secp256k1 private key",
                "",
                "Output SignatureProof:",
                '  - id: Uncompressed public key (128 hex chars, no "04" prefix)',
                "  - signature: ECDSA signature as hex string",
                '  - algorithm: "SECP256K1_RFC8785_V1"',
                "",
                "Notes:",
                "- The double-hash (SHA-256 → hex → SHA-512) is specific to Constellation Network",
                "- Use ded_sign_fingerprint / ded_prepare_fingerprint tools if available, or the signing script at ded://tools/signing-script",
                "",
                "Full documentation: https://constellation-main.gitbook.io/digital-evidence/sign-and-submit-data",
            ].join("\n"),
        },
    ],
}));
const SIGNING_SCRIPT = `#!/usr/bin/env node
// ded-sign.js — Self-contained DED signing script (Node.js 18+, zero npm dependencies)
//
// Usage:
//   node ded-sign.js sign   <privateKeyHex> '<fingerprintValueJson>'
//   node ded-sign.js keygen
//
// The sign command outputs a SignatureProof JSON object:
//   { "id": "<publicKeyHex>", "signature": "<signatureHex>", "algorithm": "SECP256K1_RFC8785_V1" }
//
// The keygen command outputs a new keypair:
//   { "privateKey": "<hex>", "publicKey": "<hex>" }

"use strict";

const crypto = require("crypto");

// ── RFC 8785 JSON Canonicalization ──────────────────────────────────
// Implements https://www.rfc-editor.org/rfc/rfc8785

function canonicalize(value) {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return "[" + value.map((v) => canonicalize(v)).join(",") + "]";
  }
  const keys = Object.keys(value).sort();
  const entries = keys
    .filter((k) => value[k] !== undefined)
    .map((k) => JSON.stringify(k) + ":" + canonicalize(value[k]));
  return "{" + entries.join(",") + "}";
}

// ── secp256k1 helpers ───────────────────────────────────────────────

function buildSec1Der(privateKeyBuf) {
  const ver = Buffer.from([0x02, 0x01, 0x01]);
  const key = Buffer.concat([Buffer.from([0x04, 0x20]), privateKeyBuf]);
  const oid = Buffer.from([0xa0, 0x07, 0x06, 0x05, 0x2b, 0x81, 0x04, 0x00, 0x0a]);
  const inner = Buffer.concat([ver, key, oid]);
  return Buffer.concat([Buffer.from([0x30, inner.length]), inner]);
}

function getPublicKey(privateKeyHex) {
  const ecdh = crypto.createECDH("secp256k1");
  ecdh.setPrivateKey(Buffer.from(privateKeyHex, "hex"));
  return ecdh.getPublicKey().subarray(1).toString("hex");
}

function makeKeyObject(privateKeyHex) {
  const der = buildSec1Der(Buffer.from(privateKeyHex, "hex"));
  return crypto.createPrivateKey({ key: der, format: "der", type: "sec1" });
}

// ── SECP256K1_RFC8785_V1 signing protocol ───────────────────────────

function sign(fingerprintValue, privateKeyHex) {
  const canonical = canonicalize(fingerprintValue);
  const sha256Hex = crypto.createHash("sha256").update(canonical, "utf8").digest("hex");
  const digest = crypto.createHash("sha512").update(sha256Hex, "utf8").digest().subarray(0, 32);
  const sig = crypto.sign(null, digest, makeKeyObject(privateKeyHex));
  return {
    id: getPublicKey(privateKeyHex),
    signature: sig.toString("hex"),
    algorithm: "SECP256K1_RFC8785_V1",
  };
}

// ── Key generation ──────────────────────────────────────────────────

function keygen() {
  const ecdh = crypto.createECDH("secp256k1");
  ecdh.generateKeys();
  return {
    privateKey: ecdh.getPrivateKey().toString("hex"),
    publicKey: ecdh.getPublicKey().subarray(1).toString("hex"),
  };
}

// ── CLI ─────────────────────────────────────────────────────────────

const [, , command, ...args] = process.argv;

if (command === "sign") {
  const [privateKey, contentJson] = args;
  if (!privateKey || !contentJson) {
    console.error("Usage: node ded-sign.js sign <privateKeyHex> '<fingerprintValueJson>'");
    process.exit(1);
  }
  const proof = sign(JSON.parse(contentJson), privateKey);
  console.log(JSON.stringify(proof, null, 2));
} else if (command === "keygen") {
  console.log(JSON.stringify(keygen(), null, 2));
} else {
  console.error("Usage:");
  console.error("  node ded-sign.js sign   <privateKeyHex> '<fingerprintValueJson>'");
  console.error("  node ded-sign.js keygen");
  process.exit(1);
}`;
server.resource("signing-script", "ded://tools/signing-script", {
    description: "Self-contained Node.js signing script (zero npm dependencies, requires Node.js 18+). " +
        "Save locally and run: node ded-sign.js sign <privateKeyHex> '<fingerprintValueJson>'",
    mimeType: "application/javascript",
}, async (uri) => ({
    contents: [
        {
            uri: uri.href,
            mimeType: "application/javascript",
            text: SIGNING_SCRIPT,
        },
    ],
}));
server.resource("batch-lifecycle-docs", "ded://docs/batch-lifecycle", {
    description: "Documentation for the batch processing lifecycle and status transitions",
    mimeType: "text/plain",
}, async (uri) => ({
    contents: [
        {
            uri: uri.href,
            mimeType: "text/plain",
            text: [
                "DED Batch Processing Lifecycle",
                "==============================",
                "",
                "Fingerprints are grouped into batches for on-chain commitment via Merkle Patricia Tries.",
                "",
                "Batch Statuses:",
                "  NEW                    → Batch created, fingerprints assigned",
                "  PENDING_COMMITMENT     → Submitted to DataL1, awaiting on-chain confirmation",
                "  FINALIZED_COMMITMENT   → Confirmed on-chain (terminal, success)",
                "  ERRORED_COMMITMENT     → Failed after max retries (terminal, error)",
                "",
                "Status Flow:",
                "  NEW → PENDING_COMMITMENT → FINALIZED_COMMITMENT",
                "                           ↘ ERRORED_COMMITMENT (after up to 10 retries)",
                "",
                "Fingerprint Status (implicit, derived from batch):",
                "  batch_id IS NULL        → UNASSIGNED (waiting for next batch cycle)",
                "  batch_id IS NOT NULL    → Check batch status for processing state",
                "",
                "Processing Pipeline:",
                "  1. Ingestion API receives fingerprints → stored with batch_id = NULL",
                "  2. BatchDaemon groups fingerprints → builds MPT → signs batch → status: NEW",
                "  3. Submission to DataL1 nodes → status: PENDING_COMMITMENT",
                "  4. Consensus: DataL1 → Metagraph L0 → Global L0",
                "  5. Indexer confirms on-chain → status: FINALIZED_COMMITMENT",
                "",
                "Key Batch Fields:",
                "  - mptRoot: Merkle Patricia Trie root hash (set at batch creation)",
                "  - globalSnapshotHash: Global L0 snapshot hash (set on finalization)",
                "  - globalSnapshotOrdinal: Global L0 snapshot ordinal (set on finalization)",
                "  - retryCount: Number of submission retry attempts",
                "",
                "Full documentation: https://constellation-main.gitbook.io/digital-evidence/find-and-verify-data",
            ].join("\n"),
        },
    ],
}));
// ── MCP Prompts (guided workflows) ──────────────────────────────────
if (config.signingPrivateKey) {
    server.prompt("notarize-document", "Guided workflow to notarize a document — hashes, signs, submits, and tracks a fingerprint", { content: z.string(), documentRef: z.string() }, async ({ content, documentRef }) => ({
        messages: [
            {
                role: "user",
                content: {
                    type: "text",
                    text: [
                        `Notarize the document "${documentRef}" using these steps:`,
                        `1. Call ded_notarize with the content, orgId, tenantId, and documentRef "${documentRef}" — this hashes, signs, and submits in one step`,
                        `2. Call ded_track_fingerprint with the fingerprint hash from the result to confirm submission`,
                        ``,
                        `If ded_notarize is not available (no API key), use the two-step flow instead:`,
                        `1. Call ded_prepare_fingerprint with the content, orgId, tenantId, and documentRef`,
                        `2. Call ded_submit_fingerprints with the prepared fingerprint EXACTLY as returned — do NOT modify any fields`,
                        ``,
                        `For full documentation on signing and submitting, see: https://constellation-main.gitbook.io/digital-evidence/sign-and-submit-data`,
                        ``,
                        `Document content:`,
                        content,
                    ].join("\n"),
                },
            },
        ],
    }));
}
server.prompt("verify-document", "Guided workflow to verify a fingerprint exists and its inclusion proof is valid", { hash: z.string() }, async ({ hash }) => ({
    messages: [
        {
            role: "user",
            content: {
                type: "text",
                text: [
                    `Verify fingerprint ${hash}:`,
                    `1. Call ded_get_fingerprint to confirm it exists and see its details`,
                    `2. If it has a batch, call ded_verify_proof to validate the MPT inclusion proof`,
                    `3. Report: the fingerprint's status, batch status, proof validity, and on-chain confirmation details`,
                    ``,
                    `For full documentation on finding and verifying data, see: https://constellation-main.gitbook.io/digital-evidence/find-and-verify-data`,
                ].join("\n"),
            },
        },
    ],
}));
server.prompt("audit-report", "Generate a summary audit report of recent fingerprinting activity", { documentId: z.string().optional() }, async ({ documentId }) => ({
    messages: [
        {
            role: "user",
            content: {
                type: "text",
                text: [
                    `Generate an audit report:`,
                    `1. Call ded_get_stats for platform overview`,
                    documentId
                        ? `2. Call ded_search_fingerprints with documentId "${documentId}" to find related fingerprints`
                        : `2. Call ded_get_latest_fingerprints for recent activity`,
                    `3. For each fingerprint found, note its hash, timestamp, batch status, and on-chain confirmation`,
                    `4. Present findings as a structured report with summary statistics`,
                ].join("\n"),
            },
        },
    ],
}));
// ── Start server ────────────────────────────────────────────────────
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
main().catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
});
//# sourceMappingURL=index.js.map