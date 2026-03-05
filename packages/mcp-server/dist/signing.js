import { signFingerprint as sdkSignFingerprint, } from "@constellation-network/digital-evidence-sdk";
/**
 * Sign a FingerprintValue using the SECP256K1_RFC8785_V1 protocol.
 * Delegates to the SDK's signFingerprint.
 */
export async function signFingerprint(fingerprintValue, privateKey) {
    const signed = await sdkSignFingerprint(fingerprintValue, privateKey);
    return signed.proofs[0];
}
//# sourceMappingURL=signing.js.map