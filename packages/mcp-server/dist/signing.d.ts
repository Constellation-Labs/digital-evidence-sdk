/**
 * Sign a FingerprintValue using the SECP256K1_RFC8785_V1 protocol.
 * Delegates to the SDK's signFingerprint.
 */
export declare function signFingerprint(fingerprintValue: Record<string, unknown>, privateKey: string): Promise<{
    id: string;
    signature: string;
    algorithm: string;
}>;
//# sourceMappingURL=signing.d.ts.map