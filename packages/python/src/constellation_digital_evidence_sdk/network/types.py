"""Network module types — API configuration, response shapes, and search parameters."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Generic, Literal, TypeVar

T = TypeVar("T")


@dataclass(frozen=True)
class DedClientConfig:
    """Configuration for the DED API client."""

    base_url: str
    api_key: str
    timeout: float = 30.0


@dataclass(frozen=True)
class DataResponse(Generic[T]):
    """Standard wrapped response from the API."""

    data: T


@dataclass(frozen=True)
class PaginationInfo:
    cursor: str | None = None
    has_more: bool = False


@dataclass(frozen=True)
class PaginatedResponse(Generic[T]):
    """Paginated response with cursor-based navigation."""

    data: T
    pagination: PaginationInfo = field(default_factory=PaginationInfo)


@dataclass(frozen=True)
class FingerprintDetail:
    """Detailed fingerprint info from search/lookup endpoints."""

    event_id: str
    document_id: str
    document_ref: str
    hash: str
    created_at: str
    batch_id: str | None = None
    tags: dict[str, str] | None = None


@dataclass(frozen=True)
class FingerprintProofData:
    batch_id: str
    batch_root: str
    signature: str
    proof_path: list[str] = field(default_factory=list)
    proof_indices: list[int] = field(default_factory=list)
    tree_height: int = 0


@dataclass(frozen=True)
class FingerprintProof:
    """Merkle proof for a finalized fingerprint."""

    hash: str
    proof: FingerprintProofData | None = None


@dataclass(frozen=True)
class BatchDetail:
    """Batch detail."""

    batch_id: str
    status: str
    fingerprint_count: int
    created_at: str
    batch_root: str | None = None
    finalized_at: str | None = None


@dataclass(frozen=True)
class PlatformStats:
    """Platform-wide statistics."""

    total_fingerprints: int
    total_batches: int
    total_finalized: int


FingerprintStatus = Literal[
    "UNASSIGNED",
    "ASSIGNED",
    "FINALIZED_COMMITMENT",
    "ERRORED_COMMITMENT",
]


@dataclass
class FingerprintSearchParams:
    """Search query parameters for GET /v1/fingerprints."""

    document_id: str | None = None
    event_id: str | None = None
    document_ref: str | None = None
    datetime_start: str | None = None
    datetime_end: str | None = None
    cursor: str | None = None
    limit: int | None = None
    tags: dict[str, str] | None = None
    forward: bool | None = None


@dataclass(frozen=True)
class DocumentInfo:
    """Document descriptor for upload. Pairs a blob with its MIME type."""

    data: bytes
    mime_type: str


@dataclass(frozen=True)
class DocumentUploadResultItem:
    """Result item from document upload."""

    event_id: str
    hash: str
    accepted: bool
    errors: list[str] = field(default_factory=list)
    document: dict | None = None
