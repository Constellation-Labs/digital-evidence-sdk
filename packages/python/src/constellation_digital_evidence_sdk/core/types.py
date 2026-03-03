"""DED domain types matching DigitalEvidence_v1.proto."""

from __future__ import annotations
from dataclasses import dataclass, field
from typing import Literal


SignatureAlgorithm = Literal["SECP256K1_RFC8785_V1"]


@dataclass(frozen=True)
class FingerprintValue:
    """Core fingerprint data that gets signed. Maps to proto FingerprintValue."""

    org_id: str
    tenant_id: str
    event_id: str
    document_id: str
    document_ref: str
    timestamp: str
    version: int = 1
    signer_id: str | None = None

    def to_dict(self) -> dict:
        """Convert to camelCase dict matching the JSON wire format."""
        result: dict = {
            "orgId": self.org_id,
            "tenantId": self.tenant_id,
            "eventId": self.event_id,
            "documentId": self.document_id,
            "documentRef": self.document_ref,
            "timestamp": self.timestamp,
            "version": self.version,
        }
        if self.signer_id is not None:
            result["signerId"] = self.signer_id
        return result


@dataclass(frozen=True)
class DedSignatureProof:
    """Cryptographic signature proof with algorithm field (DED-specific)."""

    id: str
    signature: str
    algorithm: SignatureAlgorithm = "SECP256K1_RFC8785_V1"

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "signature": self.signature,
            "algorithm": self.algorithm,
        }


@dataclass(frozen=True)
class SignedFingerprint:
    """Signed fingerprint with content and proofs. Uses 'content' not 'value'."""

    content: FingerprintValue
    proofs: list[DedSignatureProof]

    def to_dict(self) -> dict:
        return {
            "content": self.content.to_dict(),
            "proofs": [p.to_dict() for p in self.proofs],
        }


@dataclass(frozen=True)
class FingerprintMetadata:
    """Optional metadata for categorization/indexing."""

    hash: str
    tags: dict[str, str] | None = None

    def to_dict(self) -> dict:
        result: dict = {"hash": self.hash}
        if self.tags is not None:
            result["tags"] = self.tags
        return result


@dataclass(frozen=True)
class FingerprintSubmission:
    """Complete submission structure. Maps to proto FingerprintSubmission."""

    attestation: SignedFingerprint
    metadata: FingerprintMetadata | None = None

    def to_dict(self) -> dict:
        result: dict = {"attestation": self.attestation.to_dict()}
        if self.metadata is not None:
            result["metadata"] = self.metadata.to_dict()
        return result


@dataclass(frozen=True)
class FingerprintSubmissionResult:
    """API response for each submitted fingerprint."""

    event_id: str
    hash: str
    accepted: bool
    errors: list[str] = field(default_factory=list)


@dataclass
class GenerateOptions:
    """Options for the high-level generate_fingerprint() function."""

    org_id: str
    tenant_id: str
    event_id: str
    document_id: str
    document_ref: str | None = None
    document_content: str | bytes | None = None
    timestamp: str | None = None
    version: int = 1
    include_metadata: bool = False
    tags: dict[str, str] | None = None
