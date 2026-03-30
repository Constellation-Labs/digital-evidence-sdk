/** Self-contained Node.js signing script (ded-sign.js) embedded as a string constant.
 *  Requires: Node.js 18+, @constellation-network/digital-evidence-sdk */
export const SIGNING_SCRIPT = `#!/usr/bin/env node
// ded-sign.js — DED signing script
//
// Usage:
//   node ded-sign.js sign   <privateKeyHex|keyPath> '<fingerprintValueJson>'
//   node ded-sign.js keygen
//
// The sign command outputs a SignatureProof JSON object:
//   { "id": "<publicKeyHex>", "signature": "<signatureHex>", "algorithm": "SECP256K1_RFC8785_V1" }
//
// The keygen command outputs a new keypair:
//   { "privateKey": "<hex>", "publicKey": "<hex>" }
//
// Requires: npm install @constellation-network/digital-evidence-sdk

"use strict";

const crypto = require("crypto");
const fs = require("fs");
const sdk = require("@constellation-network/digital-evidence-sdk");

// ── Private key loading ─────────────────────────────────────────────

function loadPrivateKey(keyPathOrHex) {
  if (/^[0-9a-fA-F]{64}$/.test(keyPathOrHex)) return keyPathOrHex;
  const content = fs.readFileSync(keyPathOrHex, "utf-8").trim();
  if (/^[0-9a-fA-F]{64}$/.test(content)) return content;
  const keyObj = crypto.createPrivateKey(content);
  const jwk = keyObj.export({ format: "jwk" });
  return Buffer.from(jwk.d, "base64url").toString("hex");
}

// ── Wrappers ────────────────────────────────────────────────────────

function canonicalize(value) { return sdk.canonicalize(value); }

function getPublicKey(privateKeyHex) { return sdk.getPublicKeyId(privateKeyHex); }

async function sign(fingerprintValue, privateKeyHex) {
  const signed = await sdk.signFingerprint(fingerprintValue, privateKeyHex);
  return signed.proofs[0];
}

function keygen() {
  const kp = sdk.generateKeyPair();
  return { privateKey: kp.privateKey, publicKey: sdk.getPublicKeyId(kp.privateKey) };
}

// ── Exports (for use as a module) ───────────────────────────────────

if (typeof module !== "undefined") {
  module.exports = { canonicalize, getPublicKey, loadPrivateKey, sign, keygen };
}

// ── CLI ─────────────────────────────────────────────────────────────

if (require.main === module) {
  const [, , command, ...args] = process.argv;

  if (command === "sign") {
    const [privateKey, contentJson] = args;
    if (!privateKey || !contentJson) {
      console.error("Usage: node ded-sign.js sign <privateKeyHex> '<fingerprintValueJson>'");
      process.exit(1);
    }
    sign(JSON.parse(contentJson), loadPrivateKey(privateKey)).then(proof => {
      console.log(JSON.stringify(proof, null, 2));
    });
  } else if (command === "keygen") {
    console.log(JSON.stringify(keygen(), null, 2));
  } else {
    console.error("Usage:");
    console.error("  node ded-sign.js sign   <privateKeyHex> '<fingerprintValueJson>'");
    console.error("  node ded-sign.js keygen");
    process.exit(1);
  }
}`;
