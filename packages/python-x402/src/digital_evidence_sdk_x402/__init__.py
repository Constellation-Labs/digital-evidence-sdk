"""Digital Evidence SDK with x402 micropayment support.

This package provides the same API surface as ``constellation-digital-evidence-sdk``
but uses x402 payments (EIP-3009 TransferWithAuthorization) instead of API key auth.
"""

from .client import DedX402Client
from .http_client import X402ApiError, X402HttpClient
from .fingerprints_api import X402FingerprintsApi
from .signer import LocalWalletSigner, X402Signer
from .types import (
    PaymentOffer,
    PaymentOr,
    PaymentRequired,
    PaymentResult,
    X402Config,
    X402PaymentRequired,
)

# Re-export core types that users need for fingerprint generation
from constellation_digital_evidence_sdk import (
    FingerprintSubmission,
    FingerprintValue,
    GenerateOptions,
    FingerprintGenerator,
    FingerprintMetadata,
    DedSignatureProof,
    SignedFingerprint,
    generate_fingerprint,
    create_fingerprint_value,
    sign_fingerprint,
    hash_document,
    compute_metadata_hash,
    create_metadata,
    validate_submission,
    DedSdkError,
    ValidationError,
    SigningError,
)

from constellation_digital_evidence_sdk.core.wallet_uuid import (
    org_id_from_wallet,
    tenant_id_from_wallet,
)

__all__ = [
    # x402 client
    "DedX402Client",
    "X402Config",
    "X402FingerprintsApi",
    "X402HttpClient",
    "X402ApiError",
    # x402 signing
    "X402Signer",
    "LocalWalletSigner",
    # x402 types
    "PaymentOffer",
    "X402PaymentRequired",
    "PaymentOr",
    "PaymentResult",
    "PaymentRequired",
    # Core types (re-exported)
    "FingerprintSubmission",
    "FingerprintValue",
    "GenerateOptions",
    "FingerprintGenerator",
    "FingerprintMetadata",
    "DedSignatureProof",
    "SignedFingerprint",
    "generate_fingerprint",
    "create_fingerprint_value",
    "sign_fingerprint",
    "hash_document",
    "compute_metadata_hash",
    "create_metadata",
    "validate_submission",
    "DedSdkError",
    "ValidationError",
    "SigningError",
    "org_id_from_wallet",
    "tenant_id_from_wallet",
]
