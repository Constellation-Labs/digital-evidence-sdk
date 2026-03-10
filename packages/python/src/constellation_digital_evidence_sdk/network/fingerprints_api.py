"""API client for fingerprint endpoints."""

from __future__ import annotations

import asyncio
import json
import uuid
from typing import Any

from ..core.types import FingerprintSubmission, FingerprintSubmissionResult
from .http_client import DedHttpClient
from .types import (
    DocumentInfo,
    FingerprintDetail,
    FingerprintProof,
    FingerprintSearchParams,
    FingerprintStatus,
    PlatformStats,
)

ALLOWED_MIME_TYPES = frozenset({
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "application/json",
    "application/xml",
    "text/csv",
})


class FingerprintsApi:
    """API client for fingerprint endpoints.

    Authenticated endpoints require an API key (configured in DedClientConfig).
    Public endpoints work without authentication.
    """

    def __init__(self, http: DedHttpClient) -> None:
        self._http = http

    # ─── Authenticated endpoints ───────────────────────────────────

    async def submit(
        self, submissions: list[FingerprintSubmission]
    ) -> list[dict[str, Any]]:
        """Submit fingerprints for notarization.

        Args:
            submissions: List of FingerprintSubmission objects.

        Returns:
            List of result dicts with eventId, hash, accepted, errors.
        """
        body = [s.to_dict() for s in submissions]
        return await self._http.post("/v1/fingerprints", body)

    async def submit_in_batches(
        self,
        submissions: list[FingerprintSubmission],
        batch_size: int = 10,
        delay_seconds: float = 1.0,
    ) -> list[dict[str, Any]]:
        """Submit fingerprints in batches.

        Args:
            submissions: All submissions to send.
            batch_size: Number per API call.
            delay_seconds: Delay between batches.

        Returns:
            Combined results from all batches.
        """
        results: list[dict[str, Any]] = []
        for i in range(0, len(submissions), batch_size):
            batch = submissions[i : i + batch_size]
            batch_results = await self.submit(batch)
            results.extend(batch_results)
            if i + batch_size < len(submissions) and delay_seconds > 0:
                await asyncio.sleep(delay_seconds)
        return results

    async def validate(
        self, submissions: list[FingerprintSubmission]
    ) -> list[dict[str, Any]]:
        """Validate fingerprints without storing (no credits consumed).

        Args:
            submissions: Submissions to validate.

        Returns:
            Validation results.
        """
        body = [s.to_dict() for s in submissions]
        return await self._http.post("/v1/fingerprints/validate", body)

    async def upload(
        self,
        submissions: list[FingerprintSubmission],
        documents: dict[str, DocumentInfo],
    ) -> dict[str, Any]:
        """Upload fingerprints with associated documents (multipart).

        Args:
            submissions: Fingerprint submissions.
            documents: Map of documentRef (SHA-256 hex) to DocumentInfo.

        Returns:
            Response dict with ``data`` containing list of upload result items.

        Raises:
            ValueError: If a document has an unsupported MIME type.
        """
        for doc_ref, doc_info in documents.items():
            if doc_info.mime_type not in ALLOWED_MIME_TYPES:
                raise ValueError(
                    f'Unsupported mime type "{doc_info.mime_type}" for document '
                    f'"{doc_ref}". Allowed: {", ".join(sorted(ALLOWED_MIME_TYPES))}'
                )

        boundary = f"----PythonDedSdk{uuid.uuid4().hex}"
        parts: list[bytes] = []

        # Fingerprints JSON part
        fingerprints_bytes = json.dumps(
            [s.to_dict() for s in submissions]
        ).encode("utf-8")
        parts.append(
            (
                f"--{boundary}\r\n"
                f'Content-Disposition: form-data; name="fingerprints"\r\n'
                f"Content-Type: application/json\r\n"
                f"Content-Length: {len(fingerprints_bytes)}\r\n"
                f"\r\n"
            ).encode("utf-8")
        )
        parts.append(fingerprints_bytes)
        parts.append(b"\r\n")

        # Document parts
        for doc_ref, doc_info in documents.items():
            parts.append(
                (
                    f"--{boundary}\r\n"
                    f'Content-Disposition: form-data; name="{doc_ref}"; '
                    f'filename="{doc_ref}"\r\n'
                    f"Content-Type: {doc_info.mime_type}\r\n"
                    f"Content-Length: {len(doc_info.data)}\r\n"
                    f"\r\n"
                ).encode("utf-8")
            )
            parts.append(doc_info.data)
            parts.append(b"\r\n")

        # Final boundary
        parts.append(f"--{boundary}--\r\n".encode("utf-8"))

        body = b"".join(parts)
        content_type = f"multipart/form-data; boundary={boundary}"

        return await self._http.post_raw_multipart(
            "/v1/fingerprints/upload", body, content_type
        )

    async def search(self, params: FingerprintSearchParams) -> dict[str, Any]:
        """Search fingerprints with filtering and pagination.

        Args:
            params: Search query parameters.

        Returns:
            Paginated response dict with data and pagination fields.
        """
        query: dict[str, str] = {}
        if params.document_id:
            query["document_id"] = params.document_id
        if params.event_id:
            query["event_id"] = params.event_id
        if params.document_ref:
            query["document_ref"] = params.document_ref
        if params.datetime_start:
            query["datetime_start"] = params.datetime_start
        if params.datetime_end:
            query["datetime_end"] = params.datetime_end
        if params.cursor:
            query["cursor"] = params.cursor
        if params.limit is not None:
            query["limit"] = str(params.limit)
        if params.forward is not None:
            query["forward"] = str(params.forward).lower()
        if params.tags:
            query["tags"] = json.dumps(params.tags)

        return await self._http.get("/v1/fingerprints", query)

    # ─── Public endpoints ──────────────────────────────────────────

    async def get_by_hash(self, hash_value: str) -> dict[str, Any]:
        """Get fingerprint detail by its hash (public).

        Args:
            hash_value: Hex-encoded SHA-256 hash (64 characters).
        """
        return await self._http.get_public(f"/v1/fingerprints/{hash_value}")

    async def get_proof(self, hash_value: str) -> dict[str, Any]:
        """Get Merkle inclusion proof for a finalized fingerprint (public).

        Args:
            hash_value: Hex-encoded SHA-256 hash (64 characters).
        """
        return await self._http.get_public(f"/v1/fingerprints/{hash_value}/proof")

    async def get_latest(
        self,
        limit: int | None = None,
        status: FingerprintStatus | None = None,
    ) -> dict[str, Any]:
        """Get latest fingerprints (public).

        Args:
            limit: Number of fingerprints (1-500, default: 10).
            status: Optional status filter.
        """
        query: dict[str, str] = {}
        if limit is not None:
            query["limit"] = str(limit)
        if status:
            query["status"] = status
        return await self._http.get_public("/v1/fingerprints/latest", query)

    async def get_stats(self) -> dict[str, Any]:
        """Get platform-wide statistics (public)."""
        return await self._http.get_public("/v1/fingerprints/stats")
