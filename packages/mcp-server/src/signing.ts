import {
  signFingerprint as sdkSignFingerprint,
} from "@constellation-network/digital-evidence-sdk";
import type { FingerprintValue } from "@constellation-network/digital-evidence-sdk";

/**
 * Sign a FingerprintValue using the SECP256K1_RFC8785_V1 protocol.
 * Delegates to the SDK's signFingerprint.
 */
export async function signFingerprint(
  fingerprintValue: Record<string, unknown>,
  privateKey: string
): Promise<{ id: string; signature: string; algorithm: string }> {
  const signed = await sdkSignFingerprint(
    fingerprintValue as unknown as FingerprintValue,
    privateKey
  );
  return signed.proofs[0];
}
