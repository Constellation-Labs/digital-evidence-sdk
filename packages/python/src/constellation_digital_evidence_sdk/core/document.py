"""Document hashing using SHA-256."""

from constellation_sdk import hash_bytes


def hash_document(content: str | bytes) -> str:
    """Hash document content using SHA-256, returning a hex string.

    This is the standard way to produce a ``document_ref`` for a FingerprintValue.

    Args:
        content: Document content as UTF-8 string or raw bytes.

    Returns:
        Hex-encoded SHA-256 hash (64 characters).
    """
    data = content.encode("utf-8") if isinstance(content, str) else content
    return hash_bytes(data).value
