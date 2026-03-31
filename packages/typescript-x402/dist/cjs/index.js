'use strict';

var digitalEvidenceSdk = require('@constellation-network/digital-evidence-sdk');
var network = require('@constellation-network/digital-evidence-sdk/network');

/**
 * x402 fingerprint API client — same surface as the base SDK minus validate().
 */
const ALLOWED_MIME_TYPES = new Set([
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/json',
    'application/xml',
    'text/csv',
]);
/**
 * Fingerprint API client with x402 payment flow.
 *
 * Authenticated endpoints (submit, upload, search) handle the 402 payment
 * challenge automatically when autoPay=true, or return PaymentRequiredResult
 * for caller-driven payment when autoPay=false.
 *
 * Public endpoints (getByHash, getProof, getLatest, getStats) work
 * without any authentication, identical to the base SDK.
 */
class X402FingerprintsApi {
    constructor(http) {
        this.http = http;
    }
    // ─── Paid endpoints (x402) ──────────────────────────────────
    /** Submit fingerprints for notarization (x402 payment). */
    async submit(submissions) {
        return this.http.postWithPayment('/v1/fingerprints', submissions);
    }
    /** Submit fingerprints in batches (each batch is a separate x402 payment). */
    async submitInBatches(submissions, batchSize = 10, delayMs = 1000) {
        const results = [];
        for (let i = 0; i < submissions.length; i += batchSize) {
            const batch = submissions.slice(i, i + batchSize);
            const batchResult = await this.submit(batch);
            results.push(batchResult);
            if (i + batchSize < submissions.length && delayMs > 0) {
                await new Promise((resolve) => setTimeout(resolve, delayMs));
            }
        }
        return results;
    }
    /** Upload fingerprints with documents (x402 payment, multipart). */
    async upload(submissions, documents) {
        for (const [documentRef, { mimeType }] of documents) {
            if (!ALLOWED_MIME_TYPES.has(mimeType)) {
                throw new Error(`Unsupported mime type "${mimeType}" for document "${documentRef}". Allowed: ${[...ALLOWED_MIME_TYPES].join(', ')}`);
            }
        }
        const boundary = '----DedX402Sdk' + Math.random().toString(36).slice(2) + Date.now().toString(36);
        const parts = [];
        const encoder = new TextEncoder();
        // Fingerprints JSON part
        const fingerprintsJson = JSON.stringify(submissions);
        const fingerprintsBytes = encoder.encode(fingerprintsJson);
        parts.push(encoder.encode(`--${boundary}\r\n` +
            `Content-Disposition: form-data; name="fingerprints"\r\n` +
            `Content-Type: application/json\r\n` +
            `Content-Length: ${fingerprintsBytes.byteLength}\r\n` +
            `\r\n`), fingerprintsBytes, encoder.encode('\r\n'));
        // Document parts
        for (const [documentRef, { blob, mimeType }] of documents) {
            const docBytes = new Uint8Array(await blob.arrayBuffer());
            parts.push(encoder.encode(`--${boundary}\r\n` +
                `Content-Disposition: form-data; name="${documentRef}"; filename="${documentRef}"\r\n` +
                `Content-Type: ${mimeType}\r\n` +
                `Content-Length: ${docBytes.byteLength}\r\n` +
                `\r\n`), docBytes, encoder.encode('\r\n'));
        }
        // Final boundary
        parts.push(encoder.encode(`--${boundary}--\r\n`));
        // Concatenate all parts
        const totalLength = parts.reduce((sum, p) => sum + p.byteLength, 0);
        const body = new Uint8Array(totalLength);
        let offset = 0;
        for (const part of parts) {
            body.set(part, offset);
            offset += part.byteLength;
        }
        return this.http.postMultipartWithPayment('/v1/fingerprints/upload', body, `multipart/form-data; boundary=${boundary}`);
    }
    /** Search fingerprints with filtering and pagination (x402 payment). */
    async search(params) {
        const query = {};
        if (params.documentId)
            query['document_id'] = params.documentId;
        if (params.eventId)
            query['event_id'] = params.eventId;
        if (params.documentRef)
            query['document_ref'] = params.documentRef;
        if (params.datetimeStart)
            query['datetime_start'] = params.datetimeStart;
        if (params.datetimeEnd)
            query['datetime_end'] = params.datetimeEnd;
        if (params.cursor)
            query['cursor'] = params.cursor;
        if (params.limit !== undefined)
            query['limit'] = String(params.limit);
        if (params.forward !== undefined)
            query['forward'] = String(params.forward);
        if (params.tags)
            query['tags'] = JSON.stringify(params.tags);
        return this.http.getWithPayment('/v1/fingerprints', query);
    }
    // ─── Public endpoints (no auth required) ────────────────────
    /** Get fingerprint detail by its hash (public). */
    async getByHash(hash) {
        return this.http.getPublic(`/v1/fingerprints/${hash}`);
    }
    /** Get Merkle inclusion proof for a finalized fingerprint (public). */
    async getProof(hash) {
        return this.http.getPublic(`/v1/fingerprints/${hash}/proof`);
    }
    /** Get latest fingerprints (public). */
    async getLatest(limit, status) {
        const query = {};
        if (limit !== undefined)
            query['limit'] = String(limit);
        if (status)
            query['status'] = status;
        return this.http.getPublic('/v1/fingerprints/latest', query);
    }
    /** Get platform-wide statistics (public). */
    async getStats() {
        return this.http.getPublic('/v1/fingerprints/stats');
    }
}

/**
 * EIP-712 domain construction and EIP-3009 TransferWithAuthorization signing.
 */
/** EIP-712 type definitions for EIP-3009 TransferWithAuthorization */
const TRANSFER_WITH_AUTHORIZATION_TYPES = {
    TransferWithAuthorization: [
        { name: 'from', type: 'address' },
        { name: 'to', type: 'address' },
        { name: 'value', type: 'uint256' },
        { name: 'validAfter', type: 'uint256' },
        { name: 'validBefore', type: 'uint256' },
        { name: 'nonce', type: 'bytes32' },
    ],
};
/**
 * Build the EIP-712 domain from a payment offer.
 * Extracts chainId from the CAIP-2 network identifier (e.g. "eip155:84532" -> 84532).
 */
function buildEip3009Domain(offer) {
    const chainId = parseInt(offer.network.split(':')[1], 10);
    return {
        name: offer.extra?.name ?? 'USD Coin',
        version: offer.extra?.version ?? '2',
        chainId,
        verifyingContract: offer.asset,
    };
}
/** Build the TransferWithAuthorization message struct. */
function buildAuthorization(fromAddress, offer, validForSeconds = 300) {
    const now = Math.floor(Date.now() / 1000);
    const randomBytes = new Uint8Array(32);
    crypto.getRandomValues(randomBytes);
    const nonce = '0x' +
        Array.from(randomBytes)
            .map((b) => b.toString(16).padStart(2, '0'))
            .join('');
    return {
        from: fromAddress,
        to: offer.payTo,
        value: String(offer.amount),
        validAfter: '0',
        validBefore: String(now + validForSeconds),
        nonce,
    };
}
/**
 * Parse a 402 response to extract payment requirements.
 * Tries the JSON body first, then falls back to the X-PAYMENT-REQUIRED header.
 */
async function parsePaymentRequired(response) {
    // Try body
    try {
        const body = (await response.clone().json());
        if (body && Array.isArray(body['accepts'])) {
            return body;
        }
    }
    catch {
        // fall through to header
    }
    // Fallback: X-PAYMENT-REQUIRED header (base64 JSON)
    const raw = response.headers.get('X-PAYMENT-REQUIRED');
    if (!raw)
        return null;
    return JSON.parse(atob(raw));
}
/**
 * Sign an x402 payment and return the base64-encoded X-PAYMENT header value.
 *
 * Performs the full EIP-3009 TransferWithAuthorization signing flow.
 */
async function buildPaymentHeader(offer, signer, validForSeconds = 300) {
    const domain = buildEip3009Domain(offer);
    const authorization = buildAuthorization(signer.address, offer, validForSeconds);
    const signature = await signer.signTypedData(domain, TRANSFER_WITH_AUTHORIZATION_TYPES, authorization);
    const paymentPayload = {
        x402Version: 2,
        accepted: {
            scheme: offer.scheme,
            network: offer.network,
            amount: String(offer.amount),
            asset: offer.asset,
            payTo: offer.payTo,
            maxTimeoutSeconds: offer.maxTimeoutSeconds,
            extra: offer.extra ?? {},
        },
        payload: {
            signature,
            authorization,
        },
    };
    return btoa(JSON.stringify(paymentPayload));
}

/**
 * x402-aware HTTP client for the DED Ingestion API.
 */
/** Error thrown by X402HttpClient on non-402 API failures */
class X402ApiError extends Error {
    constructor(message, status, body) {
        super(message);
        this.status = status;
        this.body = body;
        this.name = 'X402ApiError';
    }
}
/**
 * HTTP client with x402 payment flow.
 *
 * On paid endpoints, sends requests without auth headers.
 * If the server returns 402, signs a payment and retries (when autoPay=true),
 * or returns a PaymentRequiredResult for the caller to handle.
 */
class X402HttpClient {
    constructor(config) {
        this.baseUrl = config.baseUrl.replace(/\/+$/, '');
        this.signer = config.signer;
        this.autoPay = config.autoPay ?? true;
        this.timeout = config.timeout ?? 30000;
    }
    /** GET with x402 payment handling */
    async getWithPayment(path, query) {
        const url = this.buildUrl(path, query);
        return this.requestWithPayment(url, { method: 'GET' });
    }
    /** POST JSON with x402 payment handling */
    async postWithPayment(path, body) {
        const url = this.buildUrl(path);
        return this.requestWithPayment(url, {
            method: 'POST',
            body: JSON.stringify(body),
            contentType: 'application/json',
        });
    }
    /** POST raw multipart with x402 payment handling */
    async postMultipartWithPayment(path, body, contentType) {
        const url = this.buildUrl(path);
        return this.requestWithPayment(url, {
            method: 'POST',
            rawBody: body,
            contentType,
        });
    }
    /** GET request for public endpoints (no auth, no 402 handling) */
    async getPublic(path, query) {
        const url = this.buildUrl(path, query);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);
        try {
            const response = await fetch(url, {
                method: 'GET',
                signal: controller.signal,
            });
            if (!response.ok) {
                throw await this.makeError(response);
            }
            return (await response.json());
        }
        finally {
            clearTimeout(timeoutId);
        }
    }
    buildUrl(path, query) {
        const url = new URL(`${this.baseUrl}${path}`);
        if (query) {
            for (const [key, value] of Object.entries(query)) {
                if (value !== undefined && value !== '') {
                    url.searchParams.set(key, value);
                }
            }
        }
        return url.toString();
    }
    async requestWithPayment(url, options) {
        const headers = {};
        if (options.contentType) {
            headers['Content-Type'] = options.contentType;
        }
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);
        try {
            const response = await fetch(url, {
                method: options.method,
                headers,
                body: options.rawBody ?? options.body,
                signal: controller.signal,
            });
            if (response.status === 402) {
                const paymentInfo = await parsePaymentRequired(response);
                if (paymentInfo) {
                    if (!this.autoPay) {
                        return { kind: 'payment_required', payment: paymentInfo };
                    }
                    // Auto-pay: sign and retry
                    clearTimeout(timeoutId);
                    const offer = paymentInfo.accepts[0];
                    const paymentHeader = await buildPaymentHeader(offer, this.signer);
                    const retryHeaders = {
                        ...headers,
                        'X-PAYMENT': paymentHeader,
                    };
                    const controller2 = new AbortController();
                    const timeoutId2 = setTimeout(() => controller2.abort(), this.timeout);
                    try {
                        const retryResponse = await fetch(url, {
                            method: options.method,
                            headers: retryHeaders,
                            body: options.rawBody ?? options.body,
                            signal: controller2.signal,
                        });
                        if (!retryResponse.ok) {
                            throw await this.makeError(retryResponse);
                        }
                        return { kind: 'result', data: (await retryResponse.json()) };
                    }
                    finally {
                        clearTimeout(timeoutId2);
                    }
                }
            }
            if (!response.ok) {
                throw await this.makeError(response);
            }
            return { kind: 'result', data: (await response.json()) };
        }
        finally {
            clearTimeout(timeoutId);
        }
    }
    async makeError(response) {
        let errorBody;
        try {
            errorBody = (await response.json());
        }
        catch {
            // Response body may not be JSON
        }
        const message = errorBody?.message ??
            errorBody?.errors?.[0]?.message ??
            `HTTP ${response.status}: ${response.statusText}`;
        return new X402ApiError(message, response.status, errorBody);
    }
}

/**
 * Top-level x402 DED client.
 */
/**
 * x402 pay-per-request client for the DED API.
 *
 * Uses an Ethereum wallet to sign EIP-3009 TransferWithAuthorization
 * payments instead of API key authentication.
 *
 * Organization and tenant IDs are deterministically derived from the
 * wallet address (UUID v5), so no prior registration is required.
 *
 * @example
 * ```ts
 * import { ethers } from 'ethers';
 * import { DedX402Client, createEthersSigner } from '@constellation-network/digital-evidence-sdk-x402';
 *
 * const wallet = new ethers.Wallet(process.env.PRIVATE_KEY!);
 * const client = new DedX402Client({
 *   baseUrl: 'https://de-api.constellationnetwork.io',
 *   signer: createEthersSigner(wallet),
 * });
 *
 * const results = await client.fingerprints.submit(submissions);
 * ```
 */
class DedX402Client {
    constructor(config) {
        const http = new X402HttpClient(config);
        this.fingerprints = new X402FingerprintsApi(http);
        this.batches = new network.BatchesApi(http);
        this.orgId = digitalEvidenceSdk.orgIdFromWallet(config.signer.address);
        this.tenantId = digitalEvidenceSdk.tenantIdFromWallet(config.signer.address);
    }
    /** The Ethereum wallet address used for payments. */
    get walletAddress() {
        return this.fingerprints['http']['signer'].address;
    }
}

/**
 * x402 signer utilities.
 */
/**
 * Create an {@link X402Signer} from an ethers.js v6 Wallet (or any compatible object).
 *
 * @example
 * ```ts
 * import { ethers } from 'ethers';
 * import { createEthersSigner } from '@constellation-network/digital-evidence-sdk-x402';
 *
 * const wallet = new ethers.Wallet(privateKey);
 * const signer = createEthersSigner(wallet);
 * ```
 */
function createEthersSigner(wallet) {
    return {
        get address() {
            return wallet.address;
        },
        async signTypedData(domain, types, value) {
            return wallet.signTypedData(domain, types, value);
        },
    };
}

Object.defineProperty(exports, "DedSdkError", {
    enumerable: true,
    get: function () { return digitalEvidenceSdk.DedSdkError; }
});
Object.defineProperty(exports, "FingerprintGenerator", {
    enumerable: true,
    get: function () { return digitalEvidenceSdk.FingerprintGenerator; }
});
Object.defineProperty(exports, "SigningError", {
    enumerable: true,
    get: function () { return digitalEvidenceSdk.SigningError; }
});
Object.defineProperty(exports, "ValidationError", {
    enumerable: true,
    get: function () { return digitalEvidenceSdk.ValidationError; }
});
Object.defineProperty(exports, "computeMetadataHash", {
    enumerable: true,
    get: function () { return digitalEvidenceSdk.computeMetadataHash; }
});
Object.defineProperty(exports, "createFingerprintValue", {
    enumerable: true,
    get: function () { return digitalEvidenceSdk.createFingerprintValue; }
});
Object.defineProperty(exports, "createMetadata", {
    enumerable: true,
    get: function () { return digitalEvidenceSdk.createMetadata; }
});
Object.defineProperty(exports, "generateFingerprint", {
    enumerable: true,
    get: function () { return digitalEvidenceSdk.generateFingerprint; }
});
Object.defineProperty(exports, "hashDocument", {
    enumerable: true,
    get: function () { return digitalEvidenceSdk.hashDocument; }
});
Object.defineProperty(exports, "orgIdFromWallet", {
    enumerable: true,
    get: function () { return digitalEvidenceSdk.orgIdFromWallet; }
});
Object.defineProperty(exports, "signFingerprint", {
    enumerable: true,
    get: function () { return digitalEvidenceSdk.signFingerprint; }
});
Object.defineProperty(exports, "tenantIdFromWallet", {
    enumerable: true,
    get: function () { return digitalEvidenceSdk.tenantIdFromWallet; }
});
Object.defineProperty(exports, "validateSubmission", {
    enumerable: true,
    get: function () { return digitalEvidenceSdk.validateSubmission; }
});
Object.defineProperty(exports, "BatchesApi", {
    enumerable: true,
    get: function () { return network.BatchesApi; }
});
exports.DedX402Client = DedX402Client;
exports.TRANSFER_WITH_AUTHORIZATION_TYPES = TRANSFER_WITH_AUTHORIZATION_TYPES;
exports.X402ApiError = X402ApiError;
exports.X402FingerprintsApi = X402FingerprintsApi;
exports.X402HttpClient = X402HttpClient;
exports.buildAuthorization = buildAuthorization;
exports.buildEip3009Domain = buildEip3009Domain;
exports.buildPaymentHeader = buildPaymentHeader;
exports.createEthersSigner = createEthersSigner;
exports.parsePaymentRequired = parsePaymentRequired;
//# sourceMappingURL=index.js.map
