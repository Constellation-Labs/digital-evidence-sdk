"""Validation helpers matching protobuf constraints."""

from __future__ import annotations

import re
from typing import Any

from .errors import ValidationError
from .types import FingerprintSubmission

_HEX_RE = re.compile(r"^[0-9a-fA-F]+$")
_UUID_RE = re.compile(
    r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}"
    r"-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$"
)


def _check(
    condition: bool, path: str, message: str, issues: list[dict[str, str]]
) -> None:
    if not condition:
        issues.append({"path": path, "message": message})


def validate_submission(submission: FingerprintSubmission) -> None:
    """Validate a FingerprintSubmission, raising ValidationError if invalid.

    Args:
        submission: The submission to validate.

    Raises:
        ValidationError: With structured issue list if validation fails.
    """
    issues: list[dict[str, str]] = []
    att = submission.attestation
    v = att.content

    # FingerprintValue validation
    _check(bool(_UUID_RE.match(v.org_id)), "orgId", "must be a valid UUID", issues)
    _check(bool(_UUID_RE.match(v.tenant_id)), "tenantId", "must be a valid UUID", issues)
    _check(bool(_UUID_RE.match(v.event_id)), "eventId", "must be a valid UUID", issues)
    _check(len(v.document_id) >= 1, "documentId", "is required", issues)
    _check(len(v.document_id) <= 256, "documentId", "must be at most 256 chars", issues)
    _check(
        32 <= len(v.document_ref) <= 128,
        "documentRef",
        "must be 32-128 characters",
        issues,
    )
    _check(
        bool(_HEX_RE.match(v.document_ref)),
        "documentRef",
        "must be hex-encoded",
        issues,
    )
    _check(bool(v.timestamp), "timestamp", "is required", issues)
    _check(v.version >= 1, "version", "must be >= 1", issues)

    if v.signer_id is not None:
        _check(
            64 <= len(v.signer_id) <= 140,
            "signerId",
            "must be 64-140 characters",
            issues,
        )
        _check(
            bool(_HEX_RE.match(v.signer_id)),
            "signerId",
            "must be hex-encoded",
            issues,
        )

    # Proofs validation
    _check(len(att.proofs) >= 1, "proofs", "at least one proof is required", issues)
    for i, proof in enumerate(att.proofs):
        prefix = f"proofs[{i}]"
        _check(
            1 <= len(proof.id) <= 140,
            f"{prefix}.id",
            "must be 1-140 characters",
            issues,
        )
        _check(
            bool(_HEX_RE.match(proof.id)),
            f"{prefix}.id",
            "must be hex-encoded",
            issues,
        )
        _check(
            64 <= len(proof.signature) <= 2048,
            f"{prefix}.signature",
            "must be 64-2048 characters",
            issues,
        )
        _check(
            proof.algorithm == "SECP256K1_RFC8785_V1",
            f"{prefix}.algorithm",
            "must be SECP256K1_RFC8785_V1",
            issues,
        )

    # Metadata validation (if present)
    meta = submission.metadata
    if meta is not None:
        _check(
            32 <= len(meta.hash) <= 128,
            "metadata.hash",
            "must be 32-128 characters",
            issues,
        )
        _check(
            bool(_HEX_RE.match(meta.hash)),
            "metadata.hash",
            "must be hex-encoded",
            issues,
        )
        if meta.tags is not None:
            _check(
                len(meta.tags) <= 6,
                "metadata.tags",
                "must have at most 6 pairs",
                issues,
            )
            for key, val in meta.tags.items():
                _check(
                    1 <= len(key) <= 32,
                    f"metadata.tags.{key}",
                    "key must be 1-32 characters",
                    issues,
                )
                _check(
                    len(val) <= 32,
                    f"metadata.tags.{key}",
                    "value must be at most 32 characters",
                    issues,
                )

    if issues:
        raise ValidationError("Invalid FingerprintSubmission", issues)
