"""Tests for X402FingerprintsApi."""

from unittest.mock import AsyncMock, Mock

import pytest

from digital_evidence_sdk_x402.fingerprints_api import X402FingerprintsApi
from digital_evidence_sdk_x402.http_client import X402HttpClient
from digital_evidence_sdk_x402.types import PaymentResult


def _mock_http() -> X402HttpClient:
    http = AsyncMock(spec=X402HttpClient)
    return http


@pytest.mark.asyncio
async def test_submit_calls_post_with_payment():
    http = _mock_http()
    http.post_with_payment.return_value = PaymentResult(
        [{"eventId": "e1", "accepted": True}]
    )

    api = X402FingerprintsApi(http)
    # Use a regular Mock (not AsyncMock) since to_dict is synchronous
    submission = Mock()
    submission.to_dict.return_value = {"orgId": "org1", "hash": "abc"}

    result = await api.submit([submission])

    http.post_with_payment.assert_called_once_with(
        "/v1/fingerprints", [{"orgId": "org1", "hash": "abc"}]
    )
    assert result.kind == "result"


@pytest.mark.asyncio
async def test_search_calls_get_with_payment():
    from constellation_digital_evidence_sdk.network.types import FingerprintSearchParams

    http = _mock_http()
    http.get_with_payment.return_value = PaymentResult({"data": [], "pagination": {}})

    api = X402FingerprintsApi(http)
    params = FingerprintSearchParams(document_id="doc1", limit=5)
    result = await api.search(params)

    http.get_with_payment.assert_called_once()
    call_args = http.get_with_payment.call_args
    assert call_args[0][0] == "/v1/fingerprints"
    query = call_args[0][1]
    assert query["document_id"] == "doc1"
    assert query["limit"] == "5"


@pytest.mark.asyncio
async def test_get_by_hash_uses_public():
    http = _mock_http()
    http.get_public.return_value = {"data": {"hash": "abc123"}}

    api = X402FingerprintsApi(http)
    result = await api.get_by_hash("abc123")

    http.get_public.assert_called_once_with("/v1/fingerprints/abc123")
    assert result == {"data": {"hash": "abc123"}}


@pytest.mark.asyncio
async def test_get_proof_uses_public():
    http = _mock_http()
    http.get_public.return_value = {"data": {"proof": {}}}

    api = X402FingerprintsApi(http)
    result = await api.get_proof("abc123")

    http.get_public.assert_called_once_with("/v1/fingerprints/abc123/proof")


@pytest.mark.asyncio
async def test_get_latest_uses_public():
    http = _mock_http()
    http.get_public.return_value = {"data": []}

    api = X402FingerprintsApi(http)
    result = await api.get_latest(limit=5, status="FINALIZED_COMMITMENT")

    http.get_public.assert_called_once()
    call_args = http.get_public.call_args
    assert call_args[0][0] == "/v1/fingerprints/latest"
    query = call_args[0][1]
    assert query["limit"] == "5"
    assert query["status"] == "FINALIZED_COMMITMENT"


@pytest.mark.asyncio
async def test_get_stats_uses_public():
    http = _mock_http()
    http.get_public.return_value = {"data": {"totalFingerprints": 100}}

    api = X402FingerprintsApi(http)
    result = await api.get_stats()

    http.get_public.assert_called_once_with("/v1/fingerprints/stats")
