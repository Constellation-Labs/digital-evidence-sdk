import { z } from "zod";

export const name = "ded_submit_fingerprint_script";
export const description =
  "Generate a Node.js script to notarize content by signing and submitting a fingerprint. " +
  "The script uses the @constellation-network/digital-evidence-sdk for signing. " +
  "Requires Node.js 18+. Credits are charged when the script is executed, not when generated. " +
  "Supports two modes: with API key (provide apiKey, orgId, tenantId) or with x402 micropayments (set walletAddress to trigger x402 mode). " +
  "Alternative: if you have DED_SIGNING_PRIVATE_KEY configured, use ded_notarize or ded_notarize_document to sign and submit directly in-process.";

export const inputSchema = z.object({
  content: z
    .string()
    .optional()
    .describe("Text content to notarize (alternative to filePath)"),
  filePath: z
    .string()
    .optional()
    .describe("Path to a file to notarize (alternative to content — file bytes are SHA-256 hashed)"),
  privateKeyPath: z
    .string()
    .describe("Private key — .pem file path, .key file path, or raw 64-char hex string"),
  documentId: z
    .string()
    .optional()
    .describe("Optional document identifier (defaults to SHA-256 hash)"),
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
    .describe("Ethereum wallet address (0x...) to enable x402 micropayment mode. Must also provide walletKeyPath."),
  walletKeyPath: z
    .string()
    .optional()
    .describe("Path to a file containing the Ethereum wallet private key for x402 payments (hex, 0x-prefixed or raw). Required when walletAddress is set."),
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
    if (!args.content && !args.filePath) {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              { error: "Either 'content' or 'filePath' is required" },
              null,
              2
            ),
          },
        ],
        isError: true,
      };
    }

    const tagsObj = tagsLiteral(args.tags);
    const apiUrl = `${apiBaseUrl}/v1/fingerprints`;

    if (args.walletAddress) {
      if (!args.walletKeyPath) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                { error: "walletKeyPath is required when using walletAddress for x402 mode" },
                null,
                2
              ),
            },
          ],
          isError: true,
        };
      }
      const script = buildX402Script(
        apiUrl,
        jsEscape(args.privateKeyPath),
        args.content ? jsEscape(args.content) : undefined,
        args.filePath ? jsEscape(args.filePath) : undefined,
        args.documentId ? jsEscape(args.documentId) : undefined,
        tagsObj,
        jsEscape(args.walletKeyPath)
      );
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                script,
                instructions:
                  "1. Write the script to a file (e.g. submit-x402.js) using a file-write tool — do NOT use shell heredocs\n" +
                  "2. Install dependencies: npm install @constellation-network/digital-evidence-sdk ethers\n" +
                  "3. Run: node submit-x402.js\n" +
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
        jsEscape(args.privateKeyPath),
        args.content ? jsEscape(args.content) : undefined,
        args.filePath ? jsEscape(args.filePath) : undefined,
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
                  "1. Write the script to a file (e.g. submit.js) using a file-write tool — do NOT use shell heredocs\n" +
                  "2. Install SDK: npm install @constellation-network/digital-evidence-sdk\n" +
                  "3. Run: node submit.js\n" +
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
  keyPath: string,
  content: string | undefined,
  filePath: string | undefined,
  documentId: string | undefined,
  tagsObj: string
): string {
  const docIdExpr = documentId ? `"${documentId}"` : "docHash";
  const hashSource = filePath
    ? `// Read file and compute SHA-256
  const fileBytes = fs.readFileSync("${filePath}");
  const docHash = crypto.createHash("sha256").update(fileBytes).digest("hex");`
    : `// Compute SHA-256 of content
  const contentStr = "${content ?? ""}";
  const docHash = crypto.createHash("sha256").update(contentStr, "utf8").digest("hex");`;

  return `#!/usr/bin/env node
// DED Fingerprint Submit Script
// Generated by ded_submit_fingerprint_script
// WARNING: Contains API key in plaintext — do not share or commit this file.

"use strict";

const crypto = require("crypto");
const fs = require("fs");
${SDK_REQUIRE}

// ── Configuration ───────────────────────────────────────────────────

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
  ${hashSource}

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
  const submission = { attestation: signed, metadata };

  console.log("Submitting fingerprint...");
  console.log("  eventId:     " + eventId);
  console.log("  documentRef: " + docHash);

  const response = await fetch(API_URL, {
    method: "POST",
    headers: { "x-api-key": API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify([submission])
  });

  const text = await response.text();
  try { console.log(JSON.stringify(JSON.parse(text), null, 2)); }
  catch { console.log(text); }

  if (!response.ok) { console.error("Submission failed with status " + response.status); process.exit(1); }
  console.log("Done.");
}

main().catch(err => { console.error(err); process.exit(1); });
`;
}

function buildX402Script(
  apiUrl: string,
  keyPath: string,
  content: string | undefined,
  filePath: string | undefined,
  documentId: string | undefined,
  tagsObj: string,
  walletKeyPath: string
): string {
  const docIdExpr = documentId ? `"${documentId}"` : "docHash";
  const hashSource = filePath
    ? `// Read file and compute SHA-256
  const fileBytes = fs.readFileSync("${filePath}");
  const docHash = crypto.createHash("sha256").update(fileBytes).digest("hex");`
    : `// Compute SHA-256 of content
  const contentStr = "${content ?? ""}";
  const docHash = crypto.createHash("sha256").update(contentStr, "utf8").digest("hex");`;

  return `#!/usr/bin/env node
// DED Fingerprint Submit Script (x402 micropayment mode)
// Generated by ded_submit_fingerprint_script
// Requires: Node.js 18+, @constellation-network/digital-evidence-sdk, ethers v6

"use strict";

const crypto = require("crypto");
const fs = require("fs");
${SDK_REQUIRE}
const { ethers } = require("ethers");

// ── Configuration ───────────────────────────────────────────────────

const KEY_PATH = "${keyPath}";
const API_URL = "${apiUrl}";
const TAGS = ${tagsObj};

const WALLET_PRIVATE_KEY = fs.readFileSync("${walletKeyPath}", "utf8").trim();
const wallet = new ethers.Wallet(WALLET_PRIVATE_KEY);

// Derive deterministic org/tenant UUIDs from wallet address (UUID v5, RFC 4122)
function uuidv5(namespace, name) {
  const nsBytes = Buffer.from(namespace.replace(/-/g, ""), "hex");
  const nameBytes = Buffer.from(name, "utf8");
  const hash = crypto.createHash("sha1").update(Buffer.concat([nsBytes, nameBytes])).digest();
  hash[6] = (hash[6] & 0x0f) | 0x50;
  hash[8] = (hash[8] & 0x3f) | 0x80;
  const hex = hash.slice(0, 16).toString("hex");
  return hex.slice(0,8)+"-"+hex.slice(8,12)+"-"+hex.slice(12,16)+"-"+hex.slice(16,20)+"-"+hex.slice(20,32);
}
const ORG_ID = uuidv5("d2b4722a-d82d-424a-8b18-3330b4ade651", wallet.address.toLowerCase());
const TENANT_ID = uuidv5("4bed9e61-6d07-4e26-9692-b81dd6994ff3", wallet.address.toLowerCase());

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

async function discoverPrice(url, body) {
  console.log("");
  console.log("--- Step 1: Price Discovery ---");
  console.log("POST " + url + " (no payment)");

  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body,
  });

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

// ── Step 3: Submit with payment ─────────────────────────────────────

async function submitWithPayment(url, body, paymentHeader, count) {
  console.log("");
  console.log("--- Step 3: Submit with X-PAYMENT ---");
  console.log("POST " + url);

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-PAYMENT": paymentHeader,
      "X-Fingerprint-Count": String(count),
    },
    body: body,
  });

  console.log("  Status: " + resp.status);
  const text = await resp.text();
  try { console.log("  Body:   " + JSON.stringify(JSON.parse(text), null, 2)); }
  catch { console.log("  Body:   " + text); }

  if (resp.status >= 400) {
    throw new Error("Submission failed with " + resp.status + ": " + text);
  }
  return text;
}

// ── Main ────────────────────────────────────────────────────────────

async function main() {
  console.log("Wallet: " + wallet.address);
  console.log("Target: " + API_URL);

  ${hashSource}

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
  const submission = { attestation: signed, metadata };

  const body = JSON.stringify([submission]);
  console.log("");
  console.log("--- Generating fingerprint ---");
  console.log("  eventId:     " + eventId);
  console.log("  documentRef: " + docHash);

  // x402 flow: discover price, sign payment, submit
  const offer = await discoverPrice(API_URL, body);
  const paymentHeader = await signPayment(offer);
  await submitWithPayment(API_URL, body, paymentHeader, 1);

  console.log("");
  console.log("--- Done ---");
  console.log("Fingerprint submitted successfully via x402 payment.");
}

main().catch(err => { console.error("Fatal: " + err.message); process.exit(1); });
`;
}
