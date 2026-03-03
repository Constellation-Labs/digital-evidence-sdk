"""Standalone HTTP client for the DED Ingestion API using httpx."""

from __future__ import annotations

import json
from typing import Any

import httpx

from .types import DedClientConfig


class DedApiError(Exception):
    """Error thrown by DedHttpClient on API failures."""

    def __init__(self, message: str, status: int, body: dict | None = None) -> None:
        super().__init__(message)
        self.status = status
        self.body = body


class DedHttpClient:
    """Async HTTP client for the DED Ingestion API.

    Uses ``httpx.AsyncClient`` for async HTTP operations.
    Injects the API key header on authenticated requests.
    """

    def __init__(self, config: DedClientConfig) -> None:
        self._base_url = config.base_url.rstrip("/")
        self._api_key = config.api_key
        self._client = httpx.AsyncClient(timeout=config.timeout)

    async def close(self) -> None:
        await self._client.aclose()

    async def get(self, path: str, query: dict[str, str] | None = None) -> Any:
        """GET request (authenticated with API key)."""
        url = f"{self._base_url}{path}"
        headers = {"X-Api-Key": self._api_key}
        return await self._request("GET", url, headers=headers, params=query)

    async def get_public(self, path: str, query: dict[str, str] | None = None) -> Any:
        """GET request (public, no API key)."""
        url = f"{self._base_url}{path}"
        return await self._request("GET", url, params=query)

    async def post(self, path: str, body: Any) -> Any:
        """POST request (authenticated with API key)."""
        url = f"{self._base_url}{path}"
        headers = {
            "X-Api-Key": self._api_key,
            "Content-Type": "application/json",
        }
        return await self._request(
            "POST", url, headers=headers, content=json.dumps(body)
        )

    async def _request(
        self,
        method: str,
        url: str,
        headers: dict[str, str] | None = None,
        params: dict[str, str] | None = None,
        content: str | None = None,
    ) -> Any:
        response = await self._client.request(
            method, url, headers=headers, params=params, content=content
        )

        if response.status_code >= 400:
            error_body = None
            try:
                error_body = response.json()
            except Exception:
                pass
            message = "API request failed"
            if error_body:
                message = (
                    error_body.get("message")
                    or (error_body.get("errors", [{}])[0].get("message"))
                    or f"HTTP {response.status_code}"
                )
            raise DedApiError(message, response.status_code, error_body)

        return response.json()
