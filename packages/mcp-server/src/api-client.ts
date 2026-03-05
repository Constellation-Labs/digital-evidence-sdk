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

export class DedApiClient {
  private baseUrl: string;
  private apiKey?: string;

  constructor(config: Config) {
    this.baseUrl = config.apiBaseUrl.replace(/\/+$/, "");
    this.apiKey = config.apiKey;
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

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(
        `DED API error: ${response.status} ${response.statusText} - ${body}`
      );
    }

    return response.json() as Promise<T>;
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
    if (!this.apiKey) {
      throw new Error("API key required for search");
    }
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
    if (!this.apiKey) {
      throw new Error("API key required for submission");
    }
    const resp = await this.request<FingerprintSubmissionResult[]>(
      "/fingerprints",
      {
        method: "POST",
        body: JSON.stringify(submissions),
      }
    );
    return resp;
  }

  async validateFingerprints(
    submissions: FingerprintSubmission[]
  ): Promise<unknown> {
    if (!this.apiKey) {
      throw new Error("API key required for validation");
    }
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
    if (!this.apiKey) {
      throw new Error("API key required for document upload");
    }

    const formData = new FormData();
    formData.append(
      "fingerprints",
      new Blob([JSON.stringify(fingerprints)], { type: "application/json" })
    );

    for (const doc of documents) {
      const bytes = Buffer.from(doc.contentBase64, "base64");
      formData.append(
        doc.documentRef,
        new Blob([bytes], { type: doc.contentType })
      );
    }

    const url = `${this.baseUrl}/v1/fingerprints/upload`;
    const headers: Record<string, string> = {
      "X-Api-Key": this.apiKey,
    };

    const response = await fetch(url, {
      method: "POST",
      headers,
      body: formData,
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(
        `DED API error: ${response.status} ${response.statusText} - ${body}`
      );
    }

    return response.json() as Promise<DocumentUploadResponse>;
  }
}
