"""Metadata construction and hashing."""

from constellation_sdk import canonicalize, hash_bytes

from .types import FingerprintMetadata, FingerprintValue


def compute_metadata_hash(value: FingerprintValue) -> str:
    """Compute the SHA-256 hash of a FingerprintValue's canonical JSON.

    Args:
        value: The FingerprintValue to hash.

    Returns:
        Hex-encoded SHA-256 hash (64 characters).
    """
    canonical = canonicalize(value.to_dict())
    return hash_bytes(canonical.encode("utf-8")).value


def create_metadata(
    value: FingerprintValue,
    tags: dict[str, str] | None = None,
) -> FingerprintMetadata:
    """Create a FingerprintMetadata with computed hash and optional tags.

    Args:
        value: The FingerprintValue to derive the hash from.
        tags: Optional key-value tags for indexing (max 6 pairs per proto).

    Returns:
        FingerprintMetadata ready for inclusion in a FingerprintSubmission.
    """
    return FingerprintMetadata(
        hash=compute_metadata_hash(value),
        tags=tags,
    )
