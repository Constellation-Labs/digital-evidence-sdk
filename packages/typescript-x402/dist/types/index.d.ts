/**
 * @constellation-network/digital-evidence-sdk-x402
 *
 * x402 micropayment extension for the Digital Evidence SDK.
 * Exposes the same API surface as the base SDK but uses x402 payments
 * (EIP-3009 TransferWithAuthorization) instead of API key authentication.
 */
export { DedX402Client } from './client';
export { X402FingerprintsApi } from './fingerprints-api';
export { X402HttpClient, X402ApiError } from './x402-http-client';
export type { ApiErrorResponse } from './x402-http-client';
export { createEthersSigner } from './signer';
export { buildEip3009Domain, buildAuthorization, buildPaymentHeader, parsePaymentRequired, TRANSFER_WITH_AUTHORIZATION_TYPES, } from './eip712';
export type { X402Config, X402Signer, EthersWalletLike, PaymentOffer, X402PaymentRequired, Eip712Domain, TransferAuthorization, PaymentPayload, PaymentOr, PaymentResult, PaymentRequiredResult, } from './types';
export type { FingerprintValue, DedSignatureProof, SignedFingerprint, FingerprintMetadata, FingerprintSubmission, FingerprintSubmissionResult, GenerateOptions, } from '@constellation-network/digital-evidence-sdk';
export { generateFingerprint, createFingerprintValue, signFingerprint, hashDocument, computeMetadataHash, createMetadata, validateSubmission, FingerprintGenerator, orgIdFromWallet, tenantIdFromWallet, DedSdkError, ValidationError, SigningError, } from '@constellation-network/digital-evidence-sdk';
export type { FingerprintDetail, FingerprintProof, FingerprintSearchParams, FingerprintStatus, BatchDetail, PlatformStats, DataResponse, PaginatedResponse, DocumentUploadResultItem, } from '@constellation-network/digital-evidence-sdk/network';
export { BatchesApi } from '@constellation-network/digital-evidence-sdk/network';
