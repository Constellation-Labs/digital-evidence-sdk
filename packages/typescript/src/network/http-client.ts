import type { DedClientConfig, ApiErrorResponse } from './types';

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
 * Automatically injects the API key header on authenticated requests.
 */
export class DedHttpClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly timeout: number;

  constructor(config: DedClientConfig) {
    // Strip trailing slash for consistent URL joining
    this.baseUrl = config.baseUrl.replace(/\/+$/, '');
    this.apiKey = config.apiKey;
    this.timeout = config.timeout ?? 30_000;
  }

  /** GET request (authenticated with API key) */
  async get<T>(path: string, query?: Record<string, string>): Promise<T> {
    const url = this.buildUrl(path, query);
    return this.request<T>(url, { method: 'GET' });
  }

  /** GET request (public, no API key) */
  async getPublic<T>(
    path: string,
    query?: Record<string, string>
  ): Promise<T> {
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
      formData?: FormData;
      public?: boolean;
    }
  ): Promise<T> {
    const headers: Record<string, string> = {};

    if (!options.public) {
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
        body: options.formData ?? options.body,
        signal: controller.signal,
      });

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
}
