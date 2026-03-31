/**
 * x402-aware HTTP client for the DED Ingestion API.
 */
import type { PaymentOr, X402Config } from './types';
/** API error response shape */
export interface ApiErrorResponse {
    errors?: Array<{
        message: string;
    }>;
    message?: string;
}
/** Error thrown by X402HttpClient on non-402 API failures */
export declare class X402ApiError extends Error {
    readonly status: number;
    readonly body?: ApiErrorResponse | undefined;
    constructor(message: string, status: number, body?: ApiErrorResponse | undefined);
}
/**
 * HTTP client with x402 payment flow.
 *
 * On paid endpoints, sends requests without auth headers.
 * If the server returns 402, signs a payment and retries (when autoPay=true),
 * or returns a PaymentRequiredResult for the caller to handle.
 */
export declare class X402HttpClient {
    private readonly baseUrl;
    private readonly signer;
    private readonly autoPay;
    private readonly timeout;
    constructor(config: X402Config);
    /** GET with x402 payment handling */
    getWithPayment<T>(path: string, query?: Record<string, string>): Promise<PaymentOr<T>>;
    /** POST JSON with x402 payment handling */
    postWithPayment<T>(path: string, body: unknown): Promise<PaymentOr<T>>;
    /** POST raw multipart with x402 payment handling */
    postMultipartWithPayment<T>(path: string, body: Uint8Array, contentType: string): Promise<PaymentOr<T>>;
    /** GET request for public endpoints (no auth, no 402 handling) */
    getPublic<T>(path: string, query?: Record<string, string>): Promise<T>;
    private buildUrl;
    private requestWithPayment;
    private makeError;
}
