import { z } from "zod";

export const name = "ded_upload_document_script";
export const description =
  "Generate a Node.js script to upload a document with a signed fingerprint. " +
  "The script uses the @constellation-network/digital-evidence-sdk for signing, computes SHA-256, and uploads via multipart POST. " +
  "Requires Node.js 18+. Credits are charged when the script is executed, not when generated. " +
  "Supports two modes: with API key (provide apiKey, orgId, tenantId) or with x402 micropayments (set walletAddress to trigger x402 mode). " +
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
    .describe("Ethereum wallet address (0x...) to enable x402 micropayment mode. The generated script reads the private key from WALLET_PRIVATE_KEY env var."),
  walletKeyPath: z
    .string()
    .optional()
    .describe("Path to a file containing the Ethereum wallet private key for x402 payments (hex, 0x-prefixed or raw). Used instead of the WALLET_PRIVATE_KEY env var."),
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

const SDK_REQUIRE = `const sdk = require("@constellation-network/digital-evidence-sdk");`;

const LOAD_PRIVATE_KEY = `function loadPrivateKey(keyPathOrHex) {
  if (/^[0-9a-fA-F]{64}$/.test(keyPathOrHex)) return keyPathOrHex;
  const content = fs.readFileSync(keyPathOrHex, "utf-8").trim();
  if (/^[0-9a-fA-F]{64}$/.test(content)) return content;
  const keyObj = crypto.createPrivateKey(content);
  const jwk = keyObj.export({ format: "jwk" });
  return Buffer.from(jwk.d, "base64url").toString("hex");
}`;

export function register(apiBaseUrl: string) {
  return async (args: z.infer<typeof inputSchema>) => {
    const tagsObj = tagsLiteral(args.tags);
    const apiUrl = `${apiBaseUrl}/v1/fingerprints/upload`;

    if (args.walletAddress) {
      const script = buildX402Script(
        apiUrl,
        jsEscape(args.filePath),
        jsEscape(args.contentType),
        jsEscape(args.privateKeyPath),
        args.documentId ? jsEscape(args.documentId) : undefined,
        tagsObj,
        args.walletKeyPath ? jsEscape(args.walletKeyPath) : undefined
      );
      const walletKeyInstr = args.walletKeyPath
        ? ""
        : "3. Set wallet key: export WALLET_PRIVATE_KEY=0x...\n";
      const runStep = args.walletKeyPath ? "3" : "4";
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                script,
                instructions:
                  "1. Write the script to a file (e.g. upload-x402.js) using a file-write tool — do NOT use shell heredocs\n" +
                  "2. Install dependencies: npm install @constellation-network/digital-evidence-sdk ethers\n" +
                  walletKeyInstr +
                  `${runStep}. Run: node upload-x402.js\n` +
                  "Requires: Node.js 18+, ethers v6 (for EIP-3009 payment signing)\n" +
                  "The script uses x402 pay-per-request — no API key needed. " +
                  "It sends an initial request, receives pricing via HTTP 402, signs an EIP-3009 authorization, and retries with payment.",
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
                  "2. Install SDK: npm install @constellation-network/digital-evidence-sdk\n" +
                  "3. Run: node upload.js\n" +
                  "Requires: Node.js 18+\n" +
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
${SDK_REQUIRE}

// ── Configuration ───────────────────────────────────────────────────

const FILE_PATH = "${filePath}";
const CONTENT_TYPE = "${contentType}";
const KEY_PATH = "${keyPath}";
const API_KEY = "${apiKey}";
const ORG_ID = "${orgId}";
const TENANT_ID = "${tenantId}";
const API_URL = "${apiUrl}";
const TAGS = ${tagsObj};

// ── Private key loading ─────────────────────────────────────────────

${LOAD_PRIVATE_KEY}

// ── Main ────────────────────────────────────────────────────────────

async function main() {
  if (!fs.existsSync(FILE_PATH)) { console.error("Error: File not found: " + FILE_PATH); process.exit(1); }

  const fileBytes = fs.readFileSync(FILE_PATH);
  const docHash = crypto.createHash("sha256").update(fileBytes).digest("hex");
  const eventId = crypto.randomUUID();
  const docId = ${docIdExpr};

  const privateKeyHex = loadPrivateKey(KEY_PATH);
  const publicKeyId = sdk.getPublicKeyId(privateKeyHex);

  const value = sdk.createFingerprintValue(
    { orgId: ORG_ID, tenantId: TENANT_ID, eventId, documentId: docId, documentRef: docHash },
    publicKeyId
  );
  value.timestamp = value.timestamp.replace(/\\.\\d{3}Z$/, "Z");

  const signed = await sdk.signFingerprint(value, privateKeyHex);
  const metadata = sdk.createMetadata(value, TAGS);
  const fingerprintEntry = { attestation: signed, metadata };
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
  apiUrl: string,
  filePath: string,
  contentType: string,
  keyPath: string,
  documentId: string | undefined,
  tagsObj: string,
  walletKeyPath: string | undefined
): string {
  const docIdExpr = documentId ? `"${documentId}"` : "docHash";

  const walletKeyLoading = walletKeyPath
    ? `const WALLET_PRIVATE_KEY = fs.readFileSync("${walletKeyPath}", "utf8").trim();`
    : `const WALLET_PRIVATE_KEY = process.env.WALLET_PRIVATE_KEY;
if (!WALLET_PRIVATE_KEY) {
  console.error("Error: WALLET_PRIVATE_KEY environment variable is required");
  console.error("  export WALLET_PRIVATE_KEY=0x...");
  process.exit(1);
}`;

  return `#!/usr/bin/env node
// DED Document Upload Script (x402 micropayment mode)
// Generated by ded_upload_document_script
// Requires: Node.js 18+, @constellation-network/digital-evidence-sdk, ethers v6

"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
${SDK_REQUIRE}
const { ethers } = require("ethers");

// ── Configuration ───────────────────────────────────────────────────

const FILE_PATH = "${filePath}";
const CONTENT_TYPE = "${contentType}";
const KEY_PATH = "${keyPath}";
const API_URL = "${apiUrl}";
const TAGS = ${tagsObj};

${walletKeyLoading}
const wallet = new ethers.Wallet(WALLET_PRIVATE_KEY);

// Derive deterministic org/tenant UUIDs from wallet address
const ORG_ID = sdk.orgIdFromWallet(wallet.address);
const TENANT_ID = sdk.tenantIdFromWallet(wallet.address);

// EIP-712 types for EIP-3009 TransferWithAuthorization
const TRANSFER_WITH_AUTHORIZATION_TYPES = {
  TransferWithAuthorization: [
    { name: "from", type: "address" },
    { name: "to", type: "address" },
    { name: "value", type: "uint256" },
    { name: "validAfter", type: "uint256" },
    { name: "validBefore", type: "uint256" },
    { name: "nonce", type: "bytes32" },
  ],
};

// ── Private key loading ─────────────────────────────────────────────

${LOAD_PRIVATE_KEY}

// ── Step 1: Price Discovery ─────────────────────────────────────────

async function discoverPrice(url, fetchOpts) {
  console.log("");
  console.log("--- Step 1: Price Discovery ---");
  console.log("POST " + url + " (no payment)");

  const resp = await fetch(url, fetchOpts);

  if (resp.status !== 402) {
    const text = await resp.text();
    throw new Error("Expected 402, got " + resp.status + ": " + text);
  }

  const data = await resp.json();
  const offer = data.accepts[0];

  console.log("  Amount:  " + offer.amount + " atomic USDC ($" + (Number(offer.amount) / 1e6).toFixed(4) + " USD)");
  console.log("  Network: " + offer.network);
  console.log("  PayTo:   " + offer.payTo);
  console.log("  Asset:   " + offer.asset);
  return offer;
}

// ── Step 2: Sign EIP-3009 TransferWithAuthorization ─────────────────

async function signPayment(offer) {
  console.log("");
  console.log("--- Step 2: Sign EIP-3009 Authorization ---");

  const chainId = parseInt(offer.network.split(":")[1], 10);
  const domain = {
    name: (offer.extra && offer.extra.name) || "USD Coin",
    version: (offer.extra && offer.extra.version) || "2",
    chainId: chainId,
    verifyingContract: offer.asset,
  };

  const now = Math.floor(Date.now() / 1000);
  const nonce = ethers.hexlify(ethers.randomBytes(32));

  const authorization = {
    from: wallet.address,
    to: offer.payTo,
    value: offer.amount,
    validAfter: "0",
    validBefore: String(now + 300),
    nonce: nonce,
  };

  console.log("  From:        " + authorization.from);
  console.log("  To:          " + authorization.to);
  console.log("  Value:       " + authorization.value);
  console.log("  ValidBefore: " + authorization.validBefore);

  const signature = await wallet.signTypedData(domain, TRANSFER_WITH_AUTHORIZATION_TYPES, authorization);
  console.log("  Signature:   " + signature.substring(0, 20) + "...");

  const paymentPayload = {
    x402Version: 2,
    accepted: {
      scheme: offer.scheme || "exact",
      network: offer.network,
      amount: String(offer.amount),
      asset: offer.asset,
      payTo: offer.payTo,
      maxTimeoutSeconds: offer.maxTimeoutSeconds || 60,
      extra: offer.extra || {},
    },
    payload: {
      signature: signature,
      authorization: authorization,
    },
  };

  const encoded = Buffer.from(JSON.stringify(paymentPayload), "utf-8").toString("base64");
  console.log("  Encoded header length: " + encoded.length + " chars");
  return encoded;
}

// ── Main ────────────────────────────────────────────────────────────

async function main() {
  console.log("Wallet: " + wallet.address);
  console.log("Target: " + API_URL);

  // Verify file exists
  if (!fs.existsSync(FILE_PATH)) {
    console.error("Error: File not found: " + FILE_PATH);
    process.exit(1);
  }

  const fileBytes = fs.readFileSync(FILE_PATH);
  const docHash = crypto.createHash("sha256").update(fileBytes).digest("hex");
  const eventId = crypto.randomUUID();
  const docId = ${docIdExpr};

  const privateKeyHex = loadPrivateKey(KEY_PATH);
  const publicKeyId = sdk.getPublicKeyId(privateKeyHex);

  const value = sdk.createFingerprintValue(
    { orgId: ORG_ID, tenantId: TENANT_ID, eventId, documentId: docId, documentRef: docHash },
    publicKeyId
  );
  value.timestamp = value.timestamp.replace(/\\.\\d{3}Z$/, "Z");

  const signed = await sdk.signFingerprint(value, privateKeyHex);
  const metadata = sdk.createMetadata(value, TAGS);
  const fingerprintEntry = { attestation: signed, metadata };
  const submissionArray = [fingerprintEntry];

  // Build multipart body
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

  const fetchOpts = {
    method: "POST",
    headers: { "Content-Type": "multipart/form-data; boundary=" + boundary },
    body: body,
  };

  // Step 1: Price discovery
  const offer = await discoverPrice(API_URL, fetchOpts);

  // Step 2: Sign EIP-3009 payment
  const paymentHeader = await signPayment(offer);

  // Step 3: Retry with payment
  console.log("");
  console.log("--- Step 3: Upload with X-PAYMENT ---");
  console.log("POST " + API_URL);

  const resp = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "multipart/form-data; boundary=" + boundary,
      "X-PAYMENT": paymentHeader,
    },
    body: body,
  });

  console.log("  Status: " + resp.status);
  const text = await resp.text();
  try { console.log("  Body:   " + JSON.stringify(JSON.parse(text), null, 2)); }
  catch { console.log("  Body:   " + text); }

  if (resp.status >= 400) {
    throw new Error("Upload failed with " + resp.status + ": " + text);
  }

  console.log("");
  console.log("--- Done ---");
  console.log("Document uploaded successfully via x402 payment.");
}

main().catch(err => { console.error("Fatal: " + err.message); process.exit(1); });
`;
}
