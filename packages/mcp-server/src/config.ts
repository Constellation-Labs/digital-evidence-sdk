import { readFileSync } from "fs";

export interface Config {
  apiBaseUrl: string;
  apiKey?: string;
  signingPrivateKey?: string;
}

function loadSigningKey(): string | undefined {
  const keyFile = process.env.DED_SIGNING_PRIVATE_KEY_FILE;
  if (keyFile) {
    try {
      return readFileSync(keyFile, "utf-8").trim();
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
