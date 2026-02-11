"""Core fingerprint operations — create, sign, and generate submissions."""

from __future__ import annotations

from datetime import datetime, timezone

from constellation_sdk import get_public_key_id, sign

from .document import hash_document
from .errors import SigningError
from .metadata import create_metadata
from .types import (
    DedSignatureProof,
    FingerprintSubmission,
    FingerprintValue,
    GenerateOptions,
    SignedFingerprint,
)


def create_fingerprint_value(
    options: GenerateOptions,
    signer_public_key_id: str | None = None,
) -> FingerprintValue:
    """Build a FingerprintValue from options without signing.

    If ``document_ref`` is not provided, it will be computed from
    ``document_content`` via SHA-256.

    Args:
        options: Fingerprint generation options.
        signer_public_key_id: Optional 128-char hex public key (no 04 prefix).

    Returns:
        A FingerprintValue ready for signing.

    Raises:
        SigningError: If neither document_ref nor document_content is provided.
    """
    document_ref = options.document_ref
    if document_ref is None:
        if options.document_content is not None:
            document_ref = hash_document(options.document_content)
        else:
            raise SigningError(
                "Either document_ref or document_content must be provided"
            )

    timestamp = options.timestamp
    if timestamp is None:
        timestamp = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

    return FingerprintValue(
        org_id=options.org_id,
        tenant_id=options.tenant_id,
        event_id=options.event_id,
        document_id=options.document_id,
        document_ref=document_ref,
        timestamp=timestamp,
        version=options.version,
        signer_id=signer_public_key_id,
    )


def sign_fingerprint(
    value: FingerprintValue,
    private_key: str,
) -> SignedFingerprint:
    """Sign a FingerprintValue, producing a DED-compatible SignedFingerprint.

    Wraps metakit's ``sign()`` but adapts the output:
      - Adds ``algorithm`` field to each proof
      - Uses ``content`` instead of metakit's ``value``

    Args:
        value: The FingerprintValue to sign.
        private_key: 64-character hex private key.

    Returns:
        SignedFingerprint with content field and algorithm-tagged proofs.

    Raises:
        SigningError: If signing fails.
    """
    try:
        metakit_proof = sign(value.to_dict(), private_key)
        ded_proof = DedSignatureProof(
            id=metakit_proof.id,
            signature=metakit_proof.signature,
            algorithm="SECP256K1_RFC8785_V1",
        )
        return SignedFingerprint(content=value, proofs=[ded_proof])
    except Exception as e:
        raise SigningError(f"Failed to sign fingerprint: {e}") from e


def generate_fingerprint(
    options: GenerateOptions,
    private_key: str,
) -> FingerprintSubmission:
    """High-level one-call API: create, sign, and package a FingerprintSubmission.

    Args:
        options: Fingerprint generation options.
        private_key: 64-character hex private key for signing.

    Returns:
        Complete FingerprintSubmission ready for API submission.
    """
    public_key_id = get_public_key_id(private_key)
    value = create_fingerprint_value(options, public_key_id)
    signed = sign_fingerprint(value, private_key)

    metadata = None
    if options.include_metadata or options.tags:
        metadata = create_metadata(value, options.tags)

    return FingerprintSubmission(attestation=signed, metadata=metadata)


class FingerprintGenerator:
    """Stateful helper holding a private key and default org/tenant IDs."""

    def __init__(
        self,
        private_key: str,
        org_id: str | None = None,
        tenant_id: str | None = None,
    ) -> None:
        self._private_key = private_key
        self._public_key_id = get_public_key_id(private_key)
        self._org_id = org_id
        self._tenant_id = tenant_id

    def generate(self, options: GenerateOptions) -> FingerprintSubmission:
        """Generate a FingerprintSubmission, merging defaults with options."""
        merged = GenerateOptions(
            org_id=options.org_id or self._org_id or "",
            tenant_id=options.tenant_id or self._tenant_id or "",
            event_id=options.event_id,
            document_id=options.document_id,
            document_ref=options.document_ref,
            document_content=options.document_content,
            timestamp=options.timestamp,
            version=options.version,
            include_metadata=options.include_metadata,
            tags=options.tags,
        )
        return generate_fingerprint(merged, self._private_key)

    @property
    def public_key_id(self) -> str:
        """Get the public key ID (128-char hex, no 04 prefix)."""
        return self._public_key_id
