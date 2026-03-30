import type { DedClientConfig, ApiErrorResponse } from './types';
import type { X402Signer } from './x402';
import { parsePaymentRequired, buildPaymentHeader } from './x402';

/** Error thrown by DedHttpClient on API failures */
export class DedApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body?: ApiErrorResponse
  ) {
    super(message);
    this.name = 'DedApiError';
  }
}

/**
 * Standalone HTTP client for the DED Ingestion API.
 *
 * Uses native `fetch` (available in Node 18+ and all modern browsers).
 * Supports API key authentication or x402 pay-per-request via an {@link X402Signer}.
 */
export class DedHttpClient {
  private readonly baseUrl: string;
  private readonly apiKey: string | undefined;
  private readonly signer: X402Signer | undefined;
  private readonly timeout: number;

  constructor(config: DedClientConfig) {
    // Strip trailing slash for consistent URL joining
    this.baseUrl = config.baseUrl.replace(/\/+$/, '');
    this.apiKey = config.apiKey;
    this.signer = config.signer;
    this.timeout = config.timeout ?? 30_000;
  }

  /** GET request (authenticated with API key) */
  async get<T>(path: string, query?: Record<string, string>): Promise<T> {
    const url = this.buildUrl(path, query);
    return this.request<T>(url, { method: 'GET' });
  }

  /** GET request (public, no API key) */
  async getPublic<T>(path: string, query?: Record<string, string>): Promise<T> {
    const url = this.buildUrl(path, query);
    return this.request<T>(url, { method: 'GET', public: true });
  }

  /** POST request (authenticated with API key) */
  async post<T>(path: string, body: unknown): Promise<T> {
    const url = this.buildUrl(path);
    return this.request<T>(url, {
      method: 'POST',
      body: JSON.stringify(body),
      contentType: 'application/json',
    });
  }

  /** POST multipart request (authenticated with API key) */
  async postMultipart<T>(path: string, formData: FormData): Promise<T> {
    const url = this.buildUrl(path);
    return this.request<T>(url, {
      method: 'POST',
      formData,
    });
  }

  /** POST raw multipart body with explicit Content-Type (authenticated with API key) */
  async postRawMultipart<T>(path: string, body: Uint8Array, contentType: string): Promise<T> {
    const url = this.buildUrl(path);
    return this.request<T>(url, {
      method: 'POST',
      rawBody: body,
      contentType,
    });
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

  private async request<T>(
    url: string,
    options: {
      method: string;
      body?: string;
      contentType?: string;
      rawBody?: Uint8Array;
      formData?: FormData;
      public?: boolean;
    }
  ): Promise<T> {
    const headers: Record<string, string> = {};

    if (!options.public && this.apiKey) {
      headers['X-Api-Key'] = this.apiKey;
    }

    if (options.contentType) {
      headers['Content-Type'] = options.contentType;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        method: options.method,
        headers,
        body: options.rawBody ?? options.formData ?? options.body,
        signal: controller.signal,
      });

      // x402 payment flow: if 402 and we have a signer (but no API key), handle payment
      if (response.status === 402 && this.signer && !this.apiKey) {
        return this.handlePaymentRequired<T>(response, url, options);
      }

      if (!response.ok) {
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
        throw new DedApiError(message, response.status, errorBody);
      }

      return (await response.json()) as T;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private async handlePaymentRequired<T>(
    response: Response,
    url: string,
    options: {
      method: string;
      body?: string;
      contentType?: string;
      rawBody?: Uint8Array;
      formData?: FormData;
    }
  ): Promise<T> {
    const paymentInfo = await parsePaymentRequired(response);
    if (!paymentInfo || paymentInfo.accepts.length === 0) {
      throw new DedApiError(
        '402 Payment Required but no payment offers received',
        402
      );
    }

    const offer = paymentInfo.accepts[0];
    const paymentHeader = await buildPaymentHeader(offer, this.signer!);

    // Retry the same request with X-PAYMENT header
    const headers: Record<string, string> = {
      'X-PAYMENT': paymentHeader,
    };

    if (options.contentType) {
      headers['Content-Type'] = options.contentType;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const retryResponse = await fetch(url, {
        method: options.method,
        headers,
        body: options.rawBody ?? options.body,
        signal: controller.signal,
      });

      if (!retryResponse.ok) {
        let errorBody: ApiErrorResponse | undefined;
        try {
          errorBody = (await retryResponse.json()) as ApiErrorResponse;
        } catch {
          // Response body may not be JSON
        }
        const message =
          errorBody?.message ??
          errorBody?.errors?.[0]?.message ??
          `HTTP ${retryResponse.status}: ${retryResponse.statusText}`;
        throw new DedApiError(message, retryResponse.status, errorBody);
      }

      return (await retryResponse.json()) as T;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
