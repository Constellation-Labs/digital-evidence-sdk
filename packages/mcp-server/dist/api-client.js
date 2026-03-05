export class DedApiClient {
    baseUrl;
    apiKey;
    constructor(config) {
        this.baseUrl = config.apiBaseUrl.replace(/\/+$/, "");
        this.apiKey = config.apiKey;
    }
    async request(path, options = {}) {
        const url = `${this.baseUrl}/v1${path}`;
        const headers = {
            "Content-Type": "application/json",
            ...options.headers,
        };
        if (this.apiKey) {
            headers["X-Api-Key"] = this.apiKey;
        }
        const response = await fetch(url, { ...options, headers });
        if (!response.ok) {
            const body = await response.text().catch(() => "");
            throw new Error(`DED API error: ${response.status} ${response.statusText} - ${body}`);
        }
        return response.json();
    }
    async getStats() {
        const resp = await this.request("/fingerprints/stats");
        return resp.data;
    }
    async getLatest(limit = 10, status) {
        const params = new URLSearchParams();
        params.set("limit", String(limit));
        if (status?.length) {
            for (const s of status)
                params.append("status", s);
        }
        const resp = await this.request(`/fingerprints/latest?${params}`);
        return resp.data;
    }
    async getFingerprint(hash) {
        try {
            const resp = await this.request(`/fingerprints/${hash}`);
            return resp.data;
        }
        catch (err) {
            if (err instanceof Error && err.message.includes("404"))
                return null;
            throw err;
        }
    }
    async getFingerprintProof(hash) {
        const resp = await this.request(`/fingerprints/${hash}/proof`);
        return resp.data;
    }
    async getBatch(batchId) {
        try {
            const resp = await this.request(`/batches/${batchId}`);
            return resp.data;
        }
        catch (err) {
            if (err instanceof Error && err.message.includes("404"))
                return null;
            throw err;
        }
    }
    async getBatchFingerprints(batchId) {
        try {
            const resp = await this.request(`/batches/${batchId}/fingerprints`);
            return resp.data;
        }
        catch (err) {
            if (err instanceof Error && err.message.includes("404"))
                return null;
            throw err;
        }
    }
    async searchFingerprints(params) {
        if (!this.apiKey) {
            throw new Error("API key required for search");
        }
        const qs = new URLSearchParams();
        if (params.documentId)
            qs.set("document_id", params.documentId);
        if (params.eventId)
            qs.set("event_id", params.eventId);
        if (params.documentRef)
            qs.set("document_ref", params.documentRef);
        if (params.datetimeStart)
            qs.set("datetime_start", params.datetimeStart);
        if (params.datetimeEnd)
            qs.set("datetime_end", params.datetimeEnd);
        if (params.tags)
            qs.set("tags", JSON.stringify(params.tags));
        if (params.limit)
            qs.set("limit", String(params.limit));
        if (params.cursor)
            qs.set("cursor", params.cursor);
        if (params.forward !== undefined)
            qs.set("forward", String(params.forward));
        return this.request(`/fingerprints?${qs}`);
    }
    async submitFingerprints(submissions) {
        if (!this.apiKey) {
            throw new Error("API key required for submission");
        }
        const resp = await this.request("/fingerprints", {
            method: "POST",
            body: JSON.stringify(submissions),
        });
        return resp;
    }
    async validateFingerprints(submissions) {
        if (!this.apiKey) {
            throw new Error("API key required for validation");
        }
        return this.request("/fingerprints/validate", {
            method: "POST",
            body: JSON.stringify(submissions),
        });
    }
    async downloadDocument(eventId) {
        const url = `${this.baseUrl}/v1/fingerprints/${eventId}/document`;
        const headers = {};
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
        throw new Error(`DED API error: ${response.status} ${response.statusText} - ${body}`);
    }
    async uploadDocuments(fingerprints, documents) {
        if (!this.apiKey) {
            throw new Error("API key required for document upload");
        }
        const formData = new FormData();
        formData.append("fingerprints", new Blob([JSON.stringify(fingerprints)], { type: "application/json" }));
        for (const doc of documents) {
            const bytes = Buffer.from(doc.contentBase64, "base64");
            formData.append(doc.documentRef, new Blob([bytes], { type: doc.contentType }));
        }
        const url = `${this.baseUrl}/v1/fingerprints/upload`;
        const headers = {
            "X-Api-Key": this.apiKey,
        };
        const response = await fetch(url, {
            method: "POST",
            headers,
            body: formData,
        });
        if (!response.ok) {
            const body = await response.text().catch(() => "");
            throw new Error(`DED API error: ${response.status} ${response.statusText} - ${body}`);
        }
        return response.json();
    }
}
//# sourceMappingURL=api-client.js.map