import { z } from "zod";
import { SIGNING_SCRIPT } from "../signing-script.js";

export const name = "ded_upload_document_script";
export const description =
  "Generate a fully self-contained Node.js script to upload a document with a signed fingerprint. " +
  "The script embeds the signing library inline, computes SHA-256, signs, and uploads via multipart POST. " +
  "Requires Node.js 18+. Credits are charged when the script is executed, not when generated. " +
  "Supports two modes: with API key (provide apiKey, orgId, tenantId) or with x402 micropayments (provide walletAddress). " +
  "Alternative: if you have DED_SIGNING_PRIVATE_KEY configured, use ded_prepare_fingerprint + ded_upload_document to upload directly in-process.";

export const inputSchema = z.object({
  filePath: z.string().describe("Path to the file to upload"),
  contentType: z
    .string()
    .describe("MIME type of the file (e.g. application/pdf, image/png)"),
  privateKeyPath: z
    .string()
    .describe("Private key — .pem file path, .key file path, or raw 64-char hex string"),
  documentId: z
    .string()
    .optional()
    .describe("Optional document identifier (defaults to SHA-256 hash of file content)"),
  tags: z
    .record(z.string())
    .optional()
    .describe("Optional key-value metadata tags (max 6 pairs)"),
  apiKey: z
    .string()
    .optional()
    .describe("DED API key for API key mode"),
  orgId: z
    .string()
    .uuid()
    .optional()
    .describe("Organization UUID (required for API key mode)"),
  tenantId: z
    .string()
    .uuid()
    .optional()
    .describe("Tenant UUID (required for API key mode)"),
  walletAddress: z
    .string()
    .regex(/^0x[0-9a-fA-F]{40}$/)
    .optional()
    .describe("Ethereum wallet address (0x...) for x402 micropayment mode"),
});

function jsEscape(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
}

function tagsLiteral(tags?: Record<string, string>): string {
  if (!tags) return "null";
  const entries = Object.entries(tags).map(
    ([k, v]) => `"${jsEscape(k)}":"${jsEscape(v)}"`
  );
  return `{${entries.join(",")}}`;
}

export function register(apiBaseUrl: string) {
  const signingScriptJson = JSON.stringify(SIGNING_SCRIPT);

  return async (args: z.infer<typeof inputSchema>) => {
    const tagsObj = tagsLiteral(args.tags);
    const apiUrl = `${apiBaseUrl}/v1/fingerprints/upload`;

    if (args.walletAddress) {
      const script = buildX402Script(
        signingScriptJson,
        apiUrl,
        jsEscape(args.walletAddress),
        jsEscape(args.filePath),
        jsEscape(args.contentType),
        jsEscape(args.privateKeyPath),
        args.documentId ? jsEscape(args.documentId) : undefined,
        tagsObj
      );
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                script,
                instructions:
                  "1. Write the script to a file (e.g. upload-x402.js) using a file-write tool — do NOT use shell heredocs\n" +
                  "2. Run: node upload-x402.js\n" +
                  "Requires: Node.js 18+ (uses built-in crypto, fs, fetch)\n" +
                  "The script uses x402 pay-per-request — no API key needed. " +
                  "It sends an initial request, receives pricing via HTTP 402, then retries with a payment header.",
              },
              null,
              2
            ),
          },
        ],
      };
    }

    if (args.apiKey && args.orgId && args.tenantId) {
      const script = buildApiKeyScript(
        signingScriptJson,
        apiUrl,
        jsEscape(args.apiKey),
        jsEscape(args.orgId),
        jsEscape(args.tenantId),
        jsEscape(args.filePath),
        jsEscape(args.contentType),
        jsEscape(args.privateKeyPath),
        args.documentId ? jsEscape(args.documentId) : undefined,
        tagsObj
      );
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                script,
                instructions:
                  "1. Write the script to a file (e.g. upload.js) using a file-write tool — do NOT use shell heredocs\n" +
                  "2. Run: node upload.js\n" +
                  "Requires: Node.js 18+ (uses built-in crypto, fs, fetch)\n" +
                  "WARNING: The script contains your API key in plaintext. Do not share or commit it.",
              },
              null,
              2
            ),
          },
        ],
      };
    }

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              error:
                "Authentication required. Either provide apiKey + orgId + tenantId for API key mode, " +
                "or provide walletAddress for x402 micropayment mode. " +
                "See ded://docs/authentication for details.",
            },
            null,
            2
          ),
        },
      ],
      isError: true,
    };
  };
}

function buildApiKeyScript(
  signingScriptJson: string,
  apiUrl: string,
  apiKey: string,
  orgId: string,
  tenantId: string,
  filePath: string,
  contentType: string,
  keyPath: string,
  documentId: string | undefined,
  tagsObj: string
): string {
  const docIdExpr = documentId ? `"${documentId}"` : "docHash";

  return `#!/usr/bin/env node
// DED Document Upload Script
// Generated by ded_upload_document_script
// WARNING: Contains API key in plaintext — do not share or commit this file.

"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const os = require("os");

// ── Configuration ───────────────────────────────────────────────────

const FILE_PATH = "${filePath}";
const CONTENT_TYPE = "${contentType}";
const KEY_PATH = "${keyPath}";
const API_KEY = "${apiKey}";
const ORG_ID = "${orgId}";
const TENANT_ID = "${tenantId}";
const API_URL = "${apiUrl}";
const TAGS = ${tagsObj};

// ── Embedded signing library ────────────────────────────────────────

const dedSignPath = path.join(os.tmpdir(), "ded-sign-" + process.pid + ".js");
fs.writeFileSync(dedSignPath, ${signingScriptJson});
const dedSign = require(dedSignPath);
fs.unlinkSync(dedSignPath);

// ── Main ────────────────────────────────────────────────────────────

async function main() {
  if (!fs.existsSync(FILE_PATH)) { console.error("Error: File not found: " + FILE_PATH); process.exit(1); }

  const fileBytes = fs.readFileSync(FILE_PATH);
  const docHash = crypto.createHash("sha256").update(fileBytes).digest("hex");
  const eventId = crypto.randomUUID();
  const timestamp = new Date().toISOString().replace(/\\.\\d{3}Z$/, "Z");
  const docId = ${docIdExpr};

  const privateKeyHex = dedSign.loadPrivateKey(KEY_PATH);
  const publicKey = dedSign.getPublicKey(privateKeyHex);

  const fingerprintValue = {
    documentId: docId, documentRef: docHash, eventId: eventId,
    orgId: ORG_ID, signerId: publicKey, tenantId: TENANT_ID,
    timestamp: timestamp, version: 1
  };

  const proof = dedSign.sign(fingerprintValue, privateKeyHex);
  const canonical = dedSign.canonicalize(fingerprintValue);
  const metadataHash = crypto.createHash("sha256").update(canonical, "utf8").digest("hex");

  const fingerprintEntry = {
    attestation: { content: fingerprintValue, proofs: [proof] },
    metadata: { hash: metadataHash }
  };
  if (TAGS) fingerprintEntry.metadata.tags = TAGS;
  const submissionArray = [fingerprintEntry];

  console.log("Uploading " + FILE_PATH + "...");

  const boundary = "----DedUpload" + crypto.randomUUID().replace(/-/g, "");
  const submissionJson = JSON.stringify(submissionArray);

  const parts = [
    "--" + boundary + "\\r\\n" +
    "Content-Disposition: form-data; name=\\"fingerprints\\"\\r\\n" +
    "Content-Type: application/json\\r\\n\\r\\n" +
    submissionJson + "\\r\\n",
    "--" + boundary + "\\r\\n" +
    "Content-Disposition: form-data; name=\\"" + docHash + "\\"; filename=\\"" + path.basename(FILE_PATH) + "\\"\\r\\n" +
    "Content-Type: " + CONTENT_TYPE + "\\r\\n" +
    "Content-Length: " + fileBytes.length + "\\r\\n\\r\\n"
  ];

  const body = Buffer.concat([
    Buffer.from(parts[0]), Buffer.from(parts[1]), fileBytes,
    Buffer.from("\\r\\n--" + boundary + "--\\r\\n")
  ]);

  const response = await fetch(API_URL, {
    method: "POST",
    headers: { "x-api-key": API_KEY, "Content-Type": "multipart/form-data; boundary=" + boundary },
    body: body
  });

  const text = await response.text();
  try { console.log(JSON.stringify(JSON.parse(text), null, 2)); }
  catch { console.log(text); }

  if (!response.ok) { console.error("Upload failed with status " + response.status); process.exit(1); }
  console.log("Done.");
}

main().catch(err => { console.error(err); process.exit(1); });
`;
}

function buildX402Script(
  signingScriptJson: string,
  apiUrl: string,
  walletAddress: string,
  filePath: string,
  contentType: string,
  keyPath: string,
  documentId: string | undefined,
  tagsObj: string
): string {
  const docIdExpr = documentId ? `"${documentId}"` : "docHash";

  return `#!/usr/bin/env node
// DED Document Upload Script (x402 micropayment mode)
// Generated by ded_upload_document_script
// No API key required — pays per request using x402 protocol.

"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const os = require("os");

// ── Configuration ───────────────────────────────────────────────────

const FILE_PATH = "${filePath}";
const CONTENT_TYPE = "${contentType}";
const KEY_PATH = "${keyPath}";
const WALLET_ADDRESS = "${walletAddress}";
const API_URL = "${apiUrl}";
const TAGS = ${tagsObj};

const ORG_ID = "00000000-0000-0000-0000-000000000000";
const TENANT_ID = "00000000-0000-0000-0000-000000000000";

// ── Embedded signing library ────────────────────────────────────────

const dedSignPath = path.join(os.tmpdir(), "ded-sign-" + process.pid + ".js");
fs.writeFileSync(dedSignPath, ${signingScriptJson});
const dedSign = require(dedSignPath);
fs.unlinkSync(dedSignPath);

// ── x402 Payment Flow ───────────────────────────────────────────────

async function payAndRetry(url, fetchOpts) {
  const initialResp = await fetch(url, fetchOpts);
  if (initialResp.status !== 402) return initialResp;

  const paymentRequiredHeader = initialResp.headers.get("x-payment-required");
  if (!paymentRequiredHeader) throw new Error("Received 402 but no X-PAYMENT-REQUIRED header found");

  const paymentRequired = JSON.parse(Buffer.from(paymentRequiredHeader, "base64").toString("utf8"));
  const offer = paymentRequired.accepts[0];

  console.log("Payment required:");
  console.log("  Amount: " + offer.amount + " atomic USDC ($" + (Number(offer.amount) / 1e6).toFixed(4) + " USD)");
  console.log("  Network: " + offer.network);
  console.log("  Pay to: " + offer.payTo);

  const now = Math.floor(Date.now() / 1000);
  const paymentPayload = {
    x402Version: 2, scheme: "exact", network: offer.network,
    payload: {
      signature: "0x",
      authorization: {
        from: WALLET_ADDRESS, to: offer.payTo, value: offer.amount,
        validAfter: "0", validBefore: String(now + 120),
        nonce: crypto.randomBytes(32).toString("hex")
      }
    }
  };

  console.log("Retrying with payment...");
  return fetch(url, {
    ...fetchOpts,
    headers: { ...fetchOpts.headers, "X-PAYMENT": Buffer.from(JSON.stringify(paymentPayload)).toString("base64") }
  });
}

// ── Main ────────────────────────────────────────────────────────────

async function main() {
  if (!fs.existsSync(FILE_PATH)) { console.error("Error: File not found: " + FILE_PATH); process.exit(1); }

  const fileBytes = fs.readFileSync(FILE_PATH);
  const docHash = crypto.createHash("sha256").update(fileBytes).digest("hex");
  const eventId = crypto.randomUUID();
  const timestamp = new Date().toISOString().replace(/\\.\\d{3}Z$/, "Z");
  const docId = ${docIdExpr};

  const privateKeyHex = dedSign.loadPrivateKey(KEY_PATH);
  const publicKey = dedSign.getPublicKey(privateKeyHex);

  const fingerprintValue = {
    documentId: docId, documentRef: docHash, eventId: eventId,
    orgId: ORG_ID, signerId: publicKey, tenantId: TENANT_ID,
    timestamp: timestamp, version: 1
  };

  const proof = dedSign.sign(fingerprintValue, privateKeyHex);
  const canonical = dedSign.canonicalize(fingerprintValue);
  const metadataHash = crypto.createHash("sha256").update(canonical, "utf8").digest("hex");

  const fingerprintEntry = {
    attestation: { content: fingerprintValue, proofs: [proof] },
    metadata: { hash: metadataHash }
  };
  if (TAGS) fingerprintEntry.metadata.tags = TAGS;
  const submissionArray = [fingerprintEntry];

  console.log("Uploading " + FILE_PATH + " via x402 micropayment...");
  console.log("  wallet: " + WALLET_ADDRESS);

  const boundary = "----DedUpload" + crypto.randomUUID().replace(/-/g, "");
  const submissionJson = JSON.stringify(submissionArray);

  const parts = [
    "--" + boundary + "\\r\\n" +
    "Content-Disposition: form-data; name=\\"fingerprints\\"\\r\\n" +
    "Content-Type: application/json\\r\\n\\r\\n" +
    submissionJson + "\\r\\n",
    "--" + boundary + "\\r\\n" +
    "Content-Disposition: form-data; name=\\"" + docHash + "\\"; filename=\\"" + path.basename(FILE_PATH) + "\\"\\r\\n" +
    "Content-Type: " + CONTENT_TYPE + "\\r\\n" +
    "Content-Length: " + fileBytes.length + "\\r\\n\\r\\n"
  ];

  const body = Buffer.concat([
    Buffer.from(parts[0]), Buffer.from(parts[1]), fileBytes,
    Buffer.from("\\r\\n--" + boundary + "--\\r\\n")
  ]);

  const response = await payAndRetry(API_URL, {
    method: "POST",
    headers: { "Content-Type": "multipart/form-data; boundary=" + boundary },
    body: body
  });

  const text = await response.text();
  try { console.log(JSON.stringify(JSON.parse(text), null, 2)); }
  catch { console.log(text); }

  if (!response.ok) { console.error("Upload failed with status " + response.status); process.exit(1); }
  console.log("Done.");
}

main().catch(err => { console.error(err); process.exit(1); });
`;
}
