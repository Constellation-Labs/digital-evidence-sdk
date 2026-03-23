/** Self-contained Node.js signing script (ded-sign.js) embedded as a string constant. */
export const SIGNING_SCRIPT = `#!/usr/bin/env node
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
const fs = require("fs");

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

// ── Private key loading ─────────────────────────────────────────────

function loadPrivateKey(keyPathOrHex) {
  if (/^[0-9a-fA-F]{64}$/.test(keyPathOrHex)) return keyPathOrHex;
  const content = fs.readFileSync(keyPathOrHex, "utf-8").trim();
  if (/^[0-9a-fA-F]{64}$/.test(content)) return content;
  const keyObj = crypto.createPrivateKey(content);
  const jwk = keyObj.export({ format: "jwk" });
  return Buffer.from(jwk.d, "base64url").toString("hex");
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
    const proof = sign(JSON.parse(contentJson), privateKey);
    console.log(JSON.stringify(proof, null, 2));
  } else if (command === "keygen") {
    console.log(JSON.stringify(keygen(), null, 2));
  } else {
    console.error("Usage:");
    console.error("  node ded-sign.js sign   <privateKeyHex> '<fingerprintValueJson>'");
    console.error("  node ded-sign.js keygen");
    process.exit(1);
  }
}`;
