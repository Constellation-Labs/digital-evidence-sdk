import { readFileSync } from "fs";
function loadSigningKey() {
    const keyFile = process.env.DED_SIGNING_PRIVATE_KEY_FILE;
    if (keyFile) {
        try {
            return readFileSync(keyFile, "utf-8").trim();
        }
        catch (err) {
            throw new Error(`Failed to read signing key from DED_SIGNING_PRIVATE_KEY_FILE="${keyFile}": ${err.message}`);
        }
    }
    return process.env.DED_SIGNING_PRIVATE_KEY;
}
export function loadConfig() {
    return {
        apiBaseUrl: process.env.DED_API_BASE_URL ?? "http://localhost:8081",
        apiKey: process.env.DED_API_KEY,
        signingPrivateKey: loadSigningKey(),
    };
}
//# sourceMappingURL=config.js.map