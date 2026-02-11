"""
Constellation DED SDK.

Python SDK for the Digital Evidence Depository (DED) on Constellation Network.
"""

from .core import (
    # DED types
    DedSignatureProof,
    FingerprintGenerator,
    FingerprintMetadata,
    FingerprintSubmission,
    FingerprintSubmissionResult,
    FingerprintValue,
    GenerateOptions,
    SignedFingerprint,
    # DED operations
    compute_metadata_hash,
    create_fingerprint_value,
    create_metadata,
    generate_fingerprint,
    hash_document,
    sign_fingerprint,
    validate_submission,
    # Errors
    DedSdkError,
    SigningError,
    ValidationError,
)

__all__ = [
    # Types
    "FingerprintValue",
    "DedSignatureProof",
    "SignedFingerprint",
    "FingerprintMetadata",
    "FingerprintSubmission",
    "FingerprintSubmissionResult",
    "GenerateOptions",
    # Operations
    "create_fingerprint_value",
    "sign_fingerprint",
    "generate_fingerprint",
    "hash_document",
    "compute_metadata_hash",
    "create_metadata",
    "validate_submission",
    "FingerprintGenerator",
    # Errors
    "DedSdkError",
    "ValidationError",
    "SigningError",
]
