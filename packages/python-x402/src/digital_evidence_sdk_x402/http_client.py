"""x402-aware HTTP client for the DED Ingestion API."""

from __future__ import annotations

import json
from typing import Any

import httpx

from .eip712 import sign_payment
from .signer import X402Signer
from .types import (
    PaymentOr,
    PaymentRequired,
    PaymentResult,
    X402Config,
    parse_payment_required,
)


class X402ApiError(Exception):
    """Error thrown by X402HttpClient on non-402 API failures."""

    def __init__(self, message: str, status: int, body: dict | None = None) -> None:
        super().__init__(message)
        self.status = status
        self.body = body


class X402HttpClient:
    """Async HTTP client with x402 payment flow.

    On authenticated endpoints, sends requests without auth headers.
    If the server returns 402, signs a payment and retries (when auto_pay=True),
    or returns a ``PaymentRequired`` for the caller to handle.
    """

    def __init__(self, config: X402Config, signer: X402Signer) -> None:
        self._base_url = config.base_url.rstrip("/")
        self._signer = signer
        self._auto_pay = config.auto_pay
        self._client = httpx.AsyncClient(timeout=config.timeout)

    async def close(self) -> None:
        await self._client.aclose()

    async def get_with_payment(
        self, path: str, query: dict[str, str] | None = None
    ) -> PaymentOr[Any]:
        """GET with x402 payment handling."""
        url = f"{self._base_url}{path}"
        return await self._request_with_payment("GET", url, params=query)

    async def post_with_payment(self, path: str, body: Any) -> PaymentOr[Any]:
        """POST JSON with x402 payment handling."""
        url = f"{self._base_url}{path}"
        headers = {"Content-Type": "application/json"}
        content = json.dumps(body)
        return await self._request_with_payment(
            "POST", url, headers=headers, content=content
        )

    async def post_multipart_with_payment(
        self, path: str, body: bytes, content_type: str
    ) -> PaymentOr[Any]:
        """POST raw multipart with x402 payment handling."""
        url = f"{self._base_url}{path}"
        headers = {"Content-Type": content_type}
        return await self._request_with_payment(
            "POST", url, headers=headers, raw_content=body
        )

    async def get_public(
        self, path: str, query: dict[str, str] | None = None
    ) -> Any:
        """GET request for public endpoints (no auth, no 402 handling)."""
        url = f"{self._base_url}{path}"
        response = await self._client.request("GET", url, params=query)
        if response.status_code >= 400:
            raise self._make_error(response)
        return response.json()

    async def _request_with_payment(
        self,
        method: str,
        url: str,
        headers: dict[str, str] | None = None,
        params: dict[str, str] | None = None,
        content: str | None = None,
        raw_content: bytes | None = None,
    ) -> PaymentOr[Any]:
        response = await self._client.request(
            method,
            url,
            headers=headers,
            params=params,
            content=raw_content or content,
        )

        if response.status_code == 402:
            body = None
            try:
                body = response.json()
            except Exception:
                pass

            resp_headers = dict(response.headers)
            payment_info = parse_payment_required(402, body, resp_headers)
            if payment_info:
                if not self._auto_pay:
                    return PaymentRequired(payment_info)

                # Auto-pay: sign and retry
                offer = payment_info.accepts[0]
                payment_header = await sign_payment(self._signer, offer)

                retry_headers = dict(headers or {})
                retry_headers["X-PAYMENT"] = payment_header

                response = await self._client.request(
                    method,
                    url,
                    headers=retry_headers,
                    params=params,
                    content=raw_content or content,
                )

                if response.status_code >= 400:
                    raise self._make_error(response)

                return PaymentResult(response.json())

        if response.status_code >= 400:
            raise self._make_error(response)

        return PaymentResult(response.json())

    @staticmethod
    def _make_error(response: httpx.Response) -> X402ApiError:
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
        return X402ApiError(message, response.status_code, error_body)
