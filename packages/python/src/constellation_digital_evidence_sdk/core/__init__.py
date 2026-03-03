"""Core module — pure cryptographic operations, no network dependencies."""

from .types import (
    DedSignatureProof,
    FingerprintMetadata,
    FingerprintSubmission,
    FingerprintSubmissionResult,
    FingerprintValue,
    GenerateOptions,
    SignedFingerprint,
)
from .document import hash_document
from .metadata import compute_metadata_hash, create_metadata
from .fingerprint import (
    create_fingerprint_value,
    sign_fingerprint,
    generate_fingerprint,
    FingerprintGenerator,
)
from .validation import validate_submission
from .errors import DedSdkError, ValidationError, SigningError

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
