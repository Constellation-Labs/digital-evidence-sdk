"""x402 fingerprint API client — same surface as the base SDK minus validate()."""

from __future__ import annotations

import asyncio
import json
import uuid
from typing import Any

from constellation_digital_evidence_sdk.core.types import FingerprintSubmission
from constellation_digital_evidence_sdk.network.fingerprints_api import ALLOWED_MIME_TYPES
from constellation_digital_evidence_sdk.network.types import (
    DocumentInfo,
    FingerprintSearchParams,
    FingerprintStatus,
)

from .http_client import X402HttpClient
from .types import PaymentOr


class X402FingerprintsApi:
    """Fingerprint API client with x402 payment flow.

    Authenticated endpoints (submit, upload, search) handle the 402 payment
    challenge automatically when ``auto_pay=True``, or return ``PaymentRequired``
    for caller-driven payment when ``auto_pay=False``.

    Public endpoints (get_by_hash, get_proof, get_latest, get_stats) work
    without any authentication, identical to the base SDK.
    """

    def __init__(self, http: X402HttpClient) -> None:
        self._http = http

    # --- Paid endpoints (x402) ---

    async def submit(
        self, submissions: list[FingerprintSubmission]
    ) -> PaymentOr[list[dict[str, Any]]]:
        """Submit fingerprints for notarization (x402 payment)."""
        body = [s.to_dict() for s in submissions]
        return await self._http.post_with_payment("/v1/fingerprints", body)

    async def submit_in_batches(
        self,
        submissions: list[FingerprintSubmission],
        batch_size: int = 10,
        delay_seconds: float = 1.0,
    ) -> list[PaymentOr[list[dict[str, Any]]]]:
        """Submit fingerprints in batches (each batch is a separate x402 payment)."""
        results: list[PaymentOr[list[dict[str, Any]]]] = []
        for i in range(0, len(submissions), batch_size):
            batch = submissions[i : i + batch_size]
            batch_result = await self.submit(batch)
            results.append(batch_result)
            if i + batch_size < len(submissions) and delay_seconds > 0:
                await asyncio.sleep(delay_seconds)
        return results

    async def upload(
        self,
        submissions: list[FingerprintSubmission],
        documents: dict[str, DocumentInfo],
    ) -> PaymentOr[dict[str, Any]]:
        """Upload fingerprints with documents (x402 payment, multipart)."""
        for doc_ref, doc_info in documents.items():
            if doc_info.mime_type not in ALLOWED_MIME_TYPES:
                raise ValueError(
                    f'Unsupported mime type "{doc_info.mime_type}" for document '
                    f'"{doc_ref}". Allowed: {", ".join(sorted(ALLOWED_MIME_TYPES))}'
                )

        boundary = f"----PythonDedX402Sdk{uuid.uuid4().hex}"
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

        return await self._http.post_multipart_with_payment(
            "/v1/fingerprints/upload", body, content_type
        )

    async def search(
        self, params: FingerprintSearchParams
    ) -> PaymentOr[dict[str, Any]]:
        """Search fingerprints with filtering and pagination (x402 payment)."""
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

        return await self._http.get_with_payment("/v1/fingerprints", query)

    # --- Public endpoints (no auth required) ---

    async def get_by_hash(self, hash_value: str) -> dict[str, Any]:
        """Get fingerprint detail by its hash (public)."""
        return await self._http.get_public(f"/v1/fingerprints/{hash_value}")

    async def get_proof(self, hash_value: str) -> dict[str, Any]:
        """Get Merkle inclusion proof for a finalized fingerprint (public)."""
        return await self._http.get_public(f"/v1/fingerprints/{hash_value}/proof")

    async def get_latest(
        self,
        limit: int | None = None,
        status: FingerprintStatus | None = None,
    ) -> dict[str, Any]:
        """Get latest fingerprints (public)."""
        query: dict[str, str] = {}
        if limit is not None:
            query["limit"] = str(limit)
        if status:
            query["status"] = status
        return await self._http.get_public("/v1/fingerprints/latest", query)

    async def get_stats(self) -> dict[str, Any]:
        """Get platform-wide statistics (public)."""
        return await self._http.get_public("/v1/fingerprints/stats")
