"""Deterministic UUID v5 (SHA-1, RFC 4122 section 4.3) derivation from Ethereum wallet addresses.

Used by the x402 payment flow so both client and server can independently compute
the same orgId and tenantId from a wallet address, keeping the fingerprint
hash stable across the signing boundary.
"""

from __future__ import annotations

import hashlib

# Fixed namespace for deriving organization UUIDs from wallet addresses.
ORG_NAMESPACE = "d2b4722a-d82d-424a-8b18-3330b4ade651"

# Fixed namespace for deriving tenant UUIDs from wallet addresses.
TENANT_NAMESPACE = "4bed9e61-6d07-4e26-9692-b81dd6994ff3"


def uuid_v5(namespace: str, name: str) -> str:
    """Generate a UUID v5 per RFC 4122 section 4.3.

    Args:
        namespace: UUID namespace string (e.g. "d2b4722a-d82d-424a-8b18-3330b4ade651").
        name: The name to hash within the namespace.

    Returns:
        UUID v5 string.
    """
    ns_bytes = bytes.fromhex(namespace.replace("-", ""))
    name_bytes = name.encode("utf-8")
    digest = bytearray(hashlib.sha1(ns_bytes + name_bytes).digest())  # noqa: S324

    # Set version 5
    digest[6] = (digest[6] & 0x0F) | 0x50
    # Set variant to RFC 4122
    digest[8] = (digest[8] & 0x3F) | 0x80

    h = digest[:16].hex()
    return f"{h[:8]}-{h[8:12]}-{h[12:16]}-{h[16:20]}-{h[20:32]}"


def org_id_from_wallet(wallet_address: str) -> str:
    """Derive a deterministic organization UUID from an Ethereum wallet address.

    The address is normalized to lowercase before hashing.
    """
    return uuid_v5(ORG_NAMESPACE, wallet_address.lower())


def tenant_id_from_wallet(wallet_address: str) -> str:
    """Derive a deterministic tenant UUID from an Ethereum wallet address.

    The address is normalized to lowercase before hashing.
    """
    return uuid_v5(TENANT_NAMESPACE, wallet_address.lower())
