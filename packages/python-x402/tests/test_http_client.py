"""Tests for X402HttpClient with mocked HTTP responses."""

import base64
import json
from unittest.mock import AsyncMock, patch

import httpx
import pytest

from digital_evidence_sdk_x402.http_client import X402ApiError, X402HttpClient
from digital_evidence_sdk_x402.types import X402Config


SAMPLE_402_BODY = {
    "x402Version": 2,
    "resource": {"url": "/v1/fingerprints", "description": "DED API"},
    "accepts": [
        {
            "scheme": "exact",
            "network": "eip155:84532",
            "amount": "20000",
            "asset": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
            "payTo": "0xRecipient",
            "maxTimeoutSeconds": 60,
            "extra": {"name": "USD Coin", "version": "2"},
        }
    ],
}


def _make_config(auto_pay: bool = True) -> X402Config:
    return X402Config(
        base_url="http://localhost:8081",
        wallet_private_key="0x4c0883a69102937d6231471b5dbb6204fe512961708279f1d7b18a1f6e8e1b3a",
        auto_pay=auto_pay,
    )


def _mock_signer():
    signer = AsyncMock()
    signer.address = "0x2c7536E3605D9C16a7a3D7b1898e529396a65c23"
    signer.sign_typed_data = AsyncMock(return_value="0x" + "ab" * 65)
    return signer


def _make_response(status_code: int, json_body: dict | list | None = None) -> httpx.Response:
    content = json.dumps(json_body).encode() if json_body is not None else b""
    return httpx.Response(
        status_code=status_code,
        content=content,
        headers={"content-type": "application/json"},
    )


@pytest.mark.asyncio
async def test_post_success_no_402():
    config = _make_config()
    signer = _mock_signer()
    client = X402HttpClient(config, signer)

    success_response = _make_response(200, [{"eventId": "e1", "accepted": True}])

    with patch.object(client._client, "request", new_callable=AsyncMock, return_value=success_response):
        result = await client.post_with_payment("/v1/fingerprints", [{}])

    assert result.kind == "result"
    assert result.data == [{"eventId": "e1", "accepted": True}]
    signer.sign_typed_data.assert_not_called()

    await client.close()


@pytest.mark.asyncio
async def test_post_402_auto_pay():
    config = _make_config(auto_pay=True)
    signer = _mock_signer()
    client = X402HttpClient(config, signer)

    response_402 = _make_response(402, SAMPLE_402_BODY)
    response_200 = _make_response(200, [{"eventId": "e1", "accepted": True}])

    call_count = 0

    async def mock_request(*args, **kwargs):
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            return response_402
        return response_200

    with patch.object(client._client, "request", side_effect=mock_request):
        result = await client.post_with_payment("/v1/fingerprints", [{}])

    assert result.kind == "result"
    assert result.data == [{"eventId": "e1", "accepted": True}]
    assert call_count == 2
    signer.sign_typed_data.assert_called_once()

    await client.close()


@pytest.mark.asyncio
async def test_post_402_no_auto_pay():
    config = _make_config(auto_pay=False)
    signer = _mock_signer()
    client = X402HttpClient(config, signer)

    response_402 = _make_response(402, SAMPLE_402_BODY)

    with patch.object(client._client, "request", new_callable=AsyncMock, return_value=response_402):
        result = await client.post_with_payment("/v1/fingerprints", [{}])

    assert result.kind == "payment_required"
    assert result.payment.accepts[0].amount == "20000"
    signer.sign_typed_data.assert_not_called()

    await client.close()


@pytest.mark.asyncio
async def test_post_402_with_header_fallback():
    config = _make_config(auto_pay=False)
    signer = _mock_signer()
    client = X402HttpClient(config, signer)

    encoded = base64.b64encode(json.dumps(SAMPLE_402_BODY).encode()).decode()
    response_402 = httpx.Response(
        status_code=402,
        content=b"Payment Required",
        headers={"X-PAYMENT-REQUIRED": encoded, "content-type": "text/plain"},
    )

    with patch.object(client._client, "request", new_callable=AsyncMock, return_value=response_402):
        result = await client.post_with_payment("/v1/fingerprints", [{}])

    assert result.kind == "payment_required"

    await client.close()


@pytest.mark.asyncio
async def test_post_500_raises_error():
    config = _make_config()
    signer = _mock_signer()
    client = X402HttpClient(config, signer)

    response_500 = _make_response(500, {"message": "Internal Server Error"})

    with patch.object(client._client, "request", new_callable=AsyncMock, return_value=response_500):
        with pytest.raises(X402ApiError) as exc_info:
            await client.post_with_payment("/v1/fingerprints", [{}])

    assert exc_info.value.status == 500

    await client.close()


@pytest.mark.asyncio
async def test_get_public_success():
    config = _make_config()
    signer = _mock_signer()
    client = X402HttpClient(config, signer)

    response_200 = _make_response(200, {"data": {"hash": "abc123"}})

    with patch.object(client._client, "request", new_callable=AsyncMock, return_value=response_200):
        result = await client.get_public("/v1/fingerprints/abc123")

    assert result == {"data": {"hash": "abc123"}}

    await client.close()


@pytest.mark.asyncio
async def test_retry_sends_x_payment_header():
    config = _make_config(auto_pay=True)
    signer = _mock_signer()
    client = X402HttpClient(config, signer)

    response_402 = _make_response(402, SAMPLE_402_BODY)
    response_200 = _make_response(200, [{"eventId": "e1", "accepted": True}])

    calls = []

    async def mock_request(*args, **kwargs):
        calls.append(kwargs)
        if len(calls) == 1:
            return response_402
        return response_200

    with patch.object(client._client, "request", side_effect=mock_request):
        await client.post_with_payment("/v1/fingerprints", [{}])

    # First call: no X-PAYMENT header
    assert "X-PAYMENT" not in (calls[0].get("headers") or {})
    # Second call: has X-PAYMENT header
    assert "X-PAYMENT" in calls[1].get("headers", {})

    await client.close()
