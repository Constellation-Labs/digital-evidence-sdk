/**
 * x402-aware HTTP client for the DED Ingestion API.
 */

import type {
  PaymentOr,
  X402Config,
  X402Signer,
} from './types';
import { buildPaymentHeader, parsePaymentRequired } from './eip712';

/** API error response shape */
export interface ApiErrorResponse {
  errors?: Array<{ message: string }>;
  message?: string;
}

/** Error thrown by X402HttpClient on non-402 API failures */
export class X402ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body?: ApiErrorResponse
  ) {
    super(message);
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
export class X402HttpClient {
  private readonly baseUrl: string;
  private readonly signer: X402Signer;
  private readonly autoPay: boolean;
  private readonly timeout: number;

  constructor(config: X402Config) {
    this.baseUrl = config.baseUrl.replace(/\/+$/, '');
    this.signer = config.signer;
    this.autoPay = config.autoPay ?? true;
    this.timeout = config.timeout ?? 30_000;
  }

  /** GET with x402 payment handling */
  async getWithPayment<T>(
    path: string,
    query?: Record<string, string>
  ): Promise<PaymentOr<T>> {
    const url = this.buildUrl(path, query);
    return this.requestWithPayment<T>(url, { method: 'GET' });
  }

  /** POST JSON with x402 payment handling */
  async postWithPayment<T>(path: string, body: unknown): Promise<PaymentOr<T>> {
    const url = this.buildUrl(path);
    return this.requestWithPayment<T>(url, {
      method: 'POST',
      body: JSON.stringify(body),
      contentType: 'application/json',
    });
  }

  /** POST raw multipart with x402 payment handling */
  async postMultipartWithPayment<T>(
    path: string,
    body: Uint8Array,
    contentType: string
  ): Promise<PaymentOr<T>> {
    const url = this.buildUrl(path);
    return this.requestWithPayment<T>(url, {
      method: 'POST',
      rawBody: body,
      contentType,
    });
  }

  /** GET request for public endpoints (no auth, no 402 handling) */
  async getPublic<T>(path: string, query?: Record<string, string>): Promise<T> {
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

      return (await response.json()) as T;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private buildUrl(path: string, query?: Record<string, string>): string {
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

  private async requestWithPayment<T>(
    url: string,
    options: {
      method: string;
      body?: string;
      rawBody?: Uint8Array;
      contentType?: string;
    }
  ): Promise<PaymentOr<T>> {
    const headers: Record<string, string> = {};
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

          const retryHeaders: Record<string, string> = {
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

            return { kind: 'result', data: (await retryResponse.json()) as T };
          } finally {
            clearTimeout(timeoutId2);
          }
        }
      }

      if (!response.ok) {
        throw await this.makeError(response);
      }

      return { kind: 'result', data: (await response.json()) as T };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private async makeError(response: Response): Promise<X402ApiError> {
    let errorBody: ApiErrorResponse | undefined;
    try {
      errorBody = (await response.json()) as ApiErrorResponse;
    } catch {
      // Response body may not be JSON
    }
    const message =
      errorBody?.message ??
      errorBody?.errors?.[0]?.message ??
      `HTTP ${response.status}: ${response.statusText}`;
    return new X402ApiError(message, response.status, errorBody);
  }
}
