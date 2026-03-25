export interface DataResponse<T> {
  data: T;
}

export interface Pagination {
  cursor: string;
}

export interface PaginatedDataResponse<T> {
  data: T;
  pagination?: Pagination;
}

export interface FingerprintDetails {
  id: string;
  hash: string;
  status: string;
  organizationId: string;
  organizationName?: string;
  tenantId: string;
  tenantName?: string;
  eventId: string;
  signer?: string;
  documentId: string;
  documentRef: string;
  proofs: SignatureProof[];
  batchId?: string;
  fingerprintTimestamp: string;
  batchLastUpdateTimestamp?: string;
  batchGlobalSnapshotHash?: string;
  batchMetagraphSnapshotHash?: string;
  mptRoot?: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  tags?: Record<string, string>;
  confirmationTimestamp?: string;
  document?: DocumentInfo;
}

export interface DocumentInfo {
  contentType?: string;
  fileSize?: number;
  downloadUrl: string;
}

export interface SignatureProof {
  id: string;
  signature: string;
  algorithm?: string;
}

export interface FingerprintSummary {
  id: string;
  hash: string;
  timestamp: string;
  orgId: string;
  orgName?: string;
  tenantId: string;
  tenantName?: string;
  status: string;
  createdAt: string;
}

export interface FingerprintGlobalStats {
  fingerprints24h: number;
  fingerprints30d: number;
  fingerprintsTotal: number;
}

export interface BatchInfo {
  id: string;
  orgId: string;
  status: string;
  globalSnapshotHash?: string;
  globalSnapshotOrdinal?: number;
  snapshotHash?: string;
  currencySnapshotOrdinal?: number;
  mptRoot?: string;
  updateHash?: string;
  retryCount: number;
  lastAttemptAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MerklePatriciaInclusionProof {
  leafKey: string;
  leafValue: string;
  root: string;
  proof: ProofNode[];
}

export interface ProofNode {
  hash: string;
  prefix: string;
  children?: Record<string, string>;
  value?: string;
}

export interface FingerprintSubmissionResult {
  hash: string;
  id: string;
  status: string;
}

export interface ValidationResult {
  valid: boolean;
  errors?: string[];
}

export interface DocumentUploadInfo {
  s3Key: string;
  contentType: string;
  fileSize: number;
  uploadedAt: string;
}

export interface DocumentUploadResultItem {
  eventId: string;
  hash: string;
  accepted: boolean;
  document: DocumentUploadInfo | null;
  errors: string[];
}

export interface DocumentUploadResponse {
  data: DocumentUploadResultItem[];
}

export interface DocumentDownloadResult {
  eventId: string;
  downloadUrl: string;
}

// ── x402 pay-per-request types ──────────────────────────────────────

export interface X402PaymentRequired {
  x402Version: number;
  resource: { url: string; description: string };
  accepts: Array<{
    scheme: string;
    network: string;
    amount: string;
    asset: string;
    payTo: string;
    maxTimeoutSeconds: number;
  }>;
}

export type PaymentOr<T> =
  | { kind: "result"; data: T }
  | { kind: "payment_required"; payment: X402PaymentRequired };
