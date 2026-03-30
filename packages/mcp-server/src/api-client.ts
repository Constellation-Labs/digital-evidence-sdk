import type { Config } from "./config.js";
import type {
  DataResponse,
  PaginatedDataResponse,
  FingerprintDetails,
  FingerprintSummary,
  FingerprintGlobalStats,
  BatchInfo,
  MerklePatriciaInclusionProof,
  FingerprintSubmissionResult,
  DocumentUploadResponse,
  DocumentDownloadResult,
} from "./types/api.js";
import type { FingerprintSubmission, DocumentInput } from "./types/fingerprint.js";
import type { X402Signer } from "@constellation-network/digital-evidence-sdk/network";
import {
  parsePaymentRequired,
  buildPaymentHeader,
} from "@constellation-network/digital-evidence-sdk/network";

export class DedApiClient {
  private baseUrl: string;
  private apiKey?: string;
  private signer?: X402Signer;

  constructor(config: Config, signer?: X402Signer) {
    this.baseUrl = config.apiBaseUrl.replace(/\/+$/, "");
    this.apiKey = config.apiKey;
    this.signer = signer;
  }

  /** Whether this client can make authenticated requests (API key or x402 signer) */
  get hasAuth(): boolean {
    return !!(this.apiKey || this.signer);
  }

  private async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}/v1${path}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string>),
    };

    if (this.apiKey) {
      headers["X-Api-Key"] = this.apiKey;
    }

    const response = await fetch(url, { ...options, headers });

    // x402 payment flow: if 402 and we have a signer (but no API key), handle payment
    if (response.status === 402 && this.signer && !this.apiKey) {
      return this.handlePaymentRequired<T>(response, url, { ...options, headers });
    }

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(
        `DED API error: ${response.status} ${response.statusText} - ${body}`
      );
    }

    return response.json() as Promise<T>;
  }

  private async handlePaymentRequired<T>(
    response: Response,
    url: string,
    options: RequestInit
  ): Promise<T> {
    const paymentInfo = await parsePaymentRequired(response);
    if (!paymentInfo || paymentInfo.accepts.length === 0) {
      throw new Error("402 Payment Required but no payment offers received");
    }

    const offer = paymentInfo.accepts[0];
    const paymentHeader = await buildPaymentHeader(offer, this.signer!);

    const headers: Record<string, string> = {
      ...(options.headers as Record<string, string>),
      "X-PAYMENT": paymentHeader,
    };
    // Remove API key header if present (shouldn't be, but defensive)
    delete headers["X-Api-Key"];

    const retryResponse = await fetch(url, { ...options, headers });

    if (!retryResponse.ok) {
      const body = await retryResponse.text().catch(() => "");
      throw new Error(
        `DED API error: ${retryResponse.status} ${retryResponse.statusText} - ${body}`
      );
    }

    return retryResponse.json() as Promise<T>;
  }

  async getStats(): Promise<FingerprintGlobalStats> {
    const resp = await this.request<DataResponse<FingerprintGlobalStats>>(
      "/fingerprints/stats"
    );
    return resp.data;
  }

  async getLatest(
    limit: number = 10,
    status?: string[]
  ): Promise<FingerprintSummary[]> {
    const params = new URLSearchParams();
    params.set("limit", String(limit));
    if (status?.length) {
      for (const s of status) params.append("status", s);
    }
    const resp = await this.request<DataResponse<FingerprintSummary[]>>(
      `/fingerprints/latest?${params}`
    );
    return resp.data;
  }

  async getFingerprint(hash: string): Promise<FingerprintDetails | null> {
    try {
      const resp = await this.request<DataResponse<FingerprintDetails>>(
        `/fingerprints/${hash}`
      );
      return resp.data;
    } catch (err) {
      if (err instanceof Error && err.message.includes("404")) return null;
      throw err;
    }
  }

  async getFingerprintProof(
    hash: string
  ): Promise<MerklePatriciaInclusionProof> {
    const resp =
      await this.request<DataResponse<MerklePatriciaInclusionProof>>(
        `/fingerprints/${hash}/proof`
      );
    return resp.data;
  }

  async getBatch(batchId: string): Promise<BatchInfo | null> {
    try {
      const resp = await this.request<DataResponse<BatchInfo>>(
        `/batches/${batchId}`
      );
      return resp.data;
    } catch (err) {
      if (err instanceof Error && err.message.includes("404")) return null;
      throw err;
    }
  }

  async getBatchFingerprints(
    batchId: string
  ): Promise<FingerprintSummary[] | null> {
    try {
      const resp = await this.request<DataResponse<FingerprintSummary[]>>(
        `/batches/${batchId}/fingerprints`
      );
      return resp.data;
    } catch (err) {
      if (err instanceof Error && err.message.includes("404")) return null;
      throw err;
    }
  }

  async searchFingerprints(params: {
    documentId?: string;
    eventId?: string;
    documentRef?: string;
    datetimeStart?: string;
    datetimeEnd?: string;
    tags?: Record<string, string>;
    limit?: number;
    cursor?: string;
    forward?: boolean;
  }): Promise<PaginatedDataResponse<FingerprintSummary[]>> {
    const qs = new URLSearchParams();
    if (params.documentId) qs.set("document_id", params.documentId);
    if (params.eventId) qs.set("event_id", params.eventId);
    if (params.documentRef) qs.set("document_ref", params.documentRef);
    if (params.datetimeStart) qs.set("datetime_start", params.datetimeStart);
    if (params.datetimeEnd) qs.set("datetime_end", params.datetimeEnd);
    if (params.tags) qs.set("tags", JSON.stringify(params.tags));
    if (params.limit) qs.set("limit", String(params.limit));
    if (params.cursor) qs.set("cursor", params.cursor);
    if (params.forward !== undefined)
      qs.set("forward", String(params.forward));

    return this.request<PaginatedDataResponse<FingerprintSummary[]>>(
      `/fingerprints?${qs}`
    );
  }

  async submitFingerprints(
    submissions: FingerprintSubmission[]
  ): Promise<FingerprintSubmissionResult[]> {
    return this.request<FingerprintSubmissionResult[]>(
      "/fingerprints",
      {
        method: "POST",
        body: JSON.stringify(submissions),
      }
    );
  }

  async validateFingerprints(
    submissions: FingerprintSubmission[]
  ): Promise<unknown> {
    return this.request("/fingerprints/validate", {
      method: "POST",
      body: JSON.stringify(submissions),
    });
  }

  async downloadDocument(
    eventId: string
  ): Promise<DocumentDownloadResult | null> {
    const url = `${this.baseUrl}/v1/fingerprints/${eventId}/document`;
    const headers: Record<string, string> = {};
    if (this.apiKey) {
      headers["X-Api-Key"] = this.apiKey;
    }

    const response = await fetch(url, { headers, redirect: "manual" });

    if (response.status === 307) {
      const location = response.headers.get("Location");
      if (!location) {
        throw new Error("307 redirect missing Location header");
      }
      return { eventId, downloadUrl: location };
    }

    if (response.status === 404) {
      return null;
    }

    const body = await response.text().catch(() => "");
    throw new Error(
      `DED API error: ${response.status} ${response.statusText} - ${body}`
    );
  }

  async uploadDocuments(
    fingerprints: FingerprintSubmission[],
    documents: DocumentInput[]
  ): Promise<DocumentUploadResponse> {
    const boundary = `----DedMcp${crypto.randomUUID().replace(/-/g, "")}`;
    const encoder = new TextEncoder();
    const parts: Uint8Array[] = [];

    // Fingerprints JSON part
    const fingerprintsJson = JSON.stringify(fingerprints);
    const fingerprintsBytes = encoder.encode(fingerprintsJson);
    parts.push(
      encoder.encode(
        `--${boundary}\r\n` +
          `Content-Disposition: form-data; name="fingerprints"\r\n` +
          `Content-Type: application/json\r\n` +
          `Content-Length: ${fingerprintsBytes.byteLength}\r\n` +
          `\r\n`
      ),
      fingerprintsBytes,
      encoder.encode("\r\n")
    );

    // Document parts
    for (const doc of documents) {
      const docBytes = Buffer.from(doc.contentBase64, "base64");
      parts.push(
        encoder.encode(
          `--${boundary}\r\n` +
            `Content-Disposition: form-data; name="${doc.documentRef}"; filename="${doc.documentRef}"\r\n` +
            `Content-Type: ${doc.contentType}\r\n` +
            `Content-Length: ${docBytes.byteLength}\r\n` +
            `\r\n`
        ),
        docBytes,
        encoder.encode("\r\n")
      );
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

    const url = `${this.baseUrl}/v1/fingerprints/upload`;
    const headers: Record<string, string> = {
      "Content-Type": `multipart/form-data; boundary=${boundary}`,
    };

    if (this.apiKey) {
      headers["X-Api-Key"] = this.apiKey;
    }

    const response = await fetch(url, {
      method: "POST",
      headers,
      body,
    });

    // x402 payment flow for multipart uploads
    if (response.status === 402 && this.signer && !this.apiKey) {
      const paymentInfo = await parsePaymentRequired(response);
      if (!paymentInfo || paymentInfo.accepts.length === 0) {
        throw new Error("402 Payment Required but no payment offers received");
      }
      const offer = paymentInfo.accepts[0];
      const paymentHeader = await buildPaymentHeader(offer, this.signer);

      const retryHeaders: Record<string, string> = {
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
        "X-PAYMENT": paymentHeader,
      };

      const retryResponse = await fetch(url, {
        method: "POST",
        headers: retryHeaders,
        body,
      });

      if (!retryResponse.ok) {
        const respBody = await retryResponse.text().catch(() => "");
        throw new Error(
          `DED API error: ${retryResponse.status} ${retryResponse.statusText} - ${respBody}`
        );
      }

      return retryResponse.json() as Promise<DocumentUploadResponse>;
    }

    if (!response.ok) {
      const respBody = await response.text().catch(() => "");
      throw new Error(
        `DED API error: ${response.status} ${response.statusText} - ${respBody}`
      );
    }

    return response.json() as Promise<DocumentUploadResponse>;
  }
}
