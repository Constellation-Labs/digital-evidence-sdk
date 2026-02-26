import { secp256k1 } from '@noble/curves/secp256k1';
import { sha256 } from '@noble/hashes/sha256';
import { sha512 } from '@noble/hashes/sha512';
import { bytesToHex, hexToBytes, randomBytes } from '@noble/hashes/utils';
import canonicalize from 'canonicalize';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { FingerprintValue, SignatureProof, Agent, StateRecord } from './types.js';

// ============================================================================
// RFC 8785 Canonical JSON
// ============================================================================

export function canonicalJson(data: unknown): string {
  const result = canonicalize(data);
  if (result === undefined) throw new Error('Failed to canonicalize data');
  return result;
}

// ============================================================================
// State Record Hashing
// ============================================================================

/** Hash the full state record — this becomes documentRef in DED fingerprints */
export function hashStateRecord(record: StateRecord): string {
  const canonical = canonicalJson(record);
  const hash = sha256(new TextEncoder().encode(canonical));
  return bytesToHex(hash);
}

/** Generic SHA-256 hash of a string */
export function hashString(data: string): string {
  return bytesToHex(sha256(new TextEncoder().encode(data)));
}

// ============================================================================
// DED Signing Protocol: SECP256K1_RFC8785_V1
//
// 1. Canonicalize JSON per RFC 8785
// 2. SHA-256 hash the canonical bytes
// 3. Convert hash to hex string, treat as UTF-8 bytes
// 4. SHA-512 hash, truncate to 32 bytes
// 5. Sign with SECP256K1
// ============================================================================

function dedMessageHash(value: FingerprintValue): Uint8Array {
  const canonical = canonicalJson(value);
  const sha256Hash = sha256(new TextEncoder().encode(canonical));
  const sha256Hex = bytesToHex(sha256Hash);
  const sha512Hash = sha512(new TextEncoder().encode(sha256Hex));
  return sha512Hash.slice(0, 32);
}

export function signFingerprint(
  value: FingerprintValue,
  privateKey: Uint8Array
): SignatureProof {
  const msgHash = dedMessageHash(value);
  const sig = secp256k1.sign(msgHash, privateKey);
  const pubKey = secp256k1.getPublicKey(privateKey, false);

  return {
    id: bytesToHex(pubKey.slice(1)),  // 128 hex chars (remove 04 prefix)
    signature: sig.toDERHex(),
    algorithm: 'SECP256K1_RFC8785_V1',
  };
}

export function verifySignature(
  value: FingerprintValue,
  proof: SignatureProof
): boolean {
  const msgHash = dedMessageHash(value);
  const pubKeyBytes = new Uint8Array([0x04, ...hexToBytes(proof.id)]);
  try {
    return secp256k1.verify(proof.signature, msgHash, pubKeyBytes);
  } catch {
    return false;
  }
}

/** Compute metadata hash (SHA-256 of canonical fingerprint value) */
export function computeMetadataHash(value: FingerprintValue): string {
  const canonical = canonicalJson(value);
  return bytesToHex(sha256(new TextEncoder().encode(canonical)));
}

// ============================================================================
// Key Management
// ============================================================================

export function generateKeyPair(): { privateKey: Uint8Array; publicKey: string } {
  const privateKey = secp256k1.utils.randomPrivateKey();
  const pubKey = secp256k1.getPublicKey(privateKey, false);
  return {
    privateKey,
    publicKey: bytesToHex(pubKey.slice(1)),
  };
}

export function getPublicKey(privateKey: Uint8Array): string {
  const pubKey = secp256k1.getPublicKey(privateKey, false);
  return bytesToHex(pubKey.slice(1));
}

export async function loadOrGenerateAgent(
  name: string,
  strategy: 'tight' | 'loose' | 'random',
  keysDir: string
): Promise<Agent> {
  const keyPath = join(keysDir, `${name}.key`);

  if (existsSync(keyPath)) {
    const hex = (await readFile(keyPath, 'utf-8')).trim();
    const privateKey = hexToBytes(hex);
    return { name, publicKey: getPublicKey(privateKey), privateKey, strategy };
  }

  await mkdir(keysDir, { recursive: true });
  const { privateKey, publicKey } = generateKeyPair();
  await writeFile(keyPath, bytesToHex(privateKey), 'utf-8');

  return { name, publicKey, privateKey, strategy };
}

// ============================================================================
// Card Commitment Scheme
//
// Deck commitment: SHA-256(seed || ":" || JSON(shuffledDeck))
// Card commitment: SHA-256(seed || ":" || position || ":" || card)
// ============================================================================

export function generateDeckSeed(): string {
  return bytesToHex(randomBytes(32));
}

export function commitDeck(seed: string, deck: string[]): string {
  return hashString(`${seed}:${JSON.stringify(deck)}`);
}

export function commitCard(seed: string, position: number, card: string): string {
  return hashString(`${seed}:${position}:${card}`);
}

export function verifyDeckCommitment(
  seed: string,
  deck: string[],
  commitment: string
): boolean {
  return commitDeck(seed, deck) === commitment;
}

// ============================================================================
// Deterministic Shuffle (Fisher-Yates with seeded PRNG)
// ============================================================================

export function shuffleDeck(deck: string[], seed: string): string[] {
  const shuffled = [...deck];
  // Use SHA-256 chain as PRNG: hash(seed || counter)
  for (let i = shuffled.length - 1; i > 0; i--) {
    const rngInput = `${seed}:shuffle:${i}`;
    const hash = sha256(new TextEncoder().encode(rngInput));
    // Use first 4 bytes as uint32 for index
    const j = ((hash[0]! << 24) | (hash[1]! << 16) | (hash[2]! << 8) | hash[3]!) >>> 0;
    const idx = j % (i + 1);
    [shuffled[i], shuffled[idx]] = [shuffled[idx]!, shuffled[i]!];
  }
  return shuffled;
}
