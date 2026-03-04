"""API client for batch endpoints (all public, no API key required)."""

from __future__ import annotations

from typing import Any

from .http_client import DedHttpClient


class BatchesApi:
    """API client for batch endpoints (all public)."""

    def __init__(self, http: DedHttpClient) -> None:
        self._http = http

    async def get(self, batch_id: str) -> dict[str, Any]:
        """Get batch details by ID (public).

        Args:
            batch_id: UUID of the batch.
        """
        return await self._http.get_public(f"/v1/batches/{batch_id}")

    async def get_fingerprints(self, batch_id: str) -> dict[str, Any]:
        """Get all fingerprints in a batch (public).

        Args:
            batch_id: UUID of the batch.
        """
        return await self._http.get_public(f"/v1/batches/{batch_id}/fingerprints")
