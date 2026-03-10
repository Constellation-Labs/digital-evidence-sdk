import { readFileSync } from "fs";
import { createPrivateKey } from "crypto";

export interface Config {
  apiBaseUrl: string;
  apiKey?: string;
  signingPrivateKey?: string;
}

/**
 * Extract a 64-char hex private key from a PEM-encoded EC private key.
 * Supports both SEC1 (EC PRIVATE KEY) and PKCS#8 (PRIVATE KEY) formats.
 */
function hexKeyFromPem(pem: string): string {
  const key = createPrivateKey(pem);
  const jwk = key.export({ format: "jwk" });
  const d = jwk.d;
  if (!d) {
    throw new Error("PEM does not contain a valid EC private key (missing 'd' parameter)");
  }
  // 'd' is base64url-encoded raw key bytes
  const hex = Buffer.from(d, "base64url").toString("hex");
  if (hex.length !== 64) {
    throw new Error(
      `Expected 32-byte (64-hex) private key, got ${hex.length / 2} bytes. Is this a secp256k1 key?`
    );
  }
  return hex;
}

function loadSigningKey(): string | undefined {
  const keyFile = process.env.DED_SIGNING_PRIVATE_KEY_FILE;
  if (keyFile) {
    try {
      const content = readFileSync(keyFile, "utf-8").trim();
      if (content.startsWith("-----BEGIN")) {
        return hexKeyFromPem(content);
      }
      return content;
    } catch (err) {
      throw new Error(
        `Failed to read signing key from DED_SIGNING_PRIVATE_KEY_FILE="${keyFile}": ${(err as Error).message}`
      );
    }
  }
  return process.env.DED_SIGNING_PRIVATE_KEY;
}

export function loadConfig(): Config {
  return {
    apiBaseUrl: process.env.DED_API_BASE_URL ?? "http://localhost:8081",
    apiKey: process.env.DED_API_KEY,
    signingPrivateKey: loadSigningKey(),
  };
}
