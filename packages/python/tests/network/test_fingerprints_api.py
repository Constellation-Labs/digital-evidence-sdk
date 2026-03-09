"""Tests for the network fingerprints API client."""

import json
from unittest.mock import AsyncMock, patch

import httpx
import pytest

from constellation_digital_evidence_sdk.network import DedClient, DocumentInfo
from constellation_digital_evidence_sdk.network.types import DedClientConfig, FingerprintSearchParams
from constellation_digital_evidence_sdk.network.http_client import DedApiError
from constellation_digital_evidence_sdk.core.types import (
    FingerprintSubmission,
    SignedFingerprint,
    FingerprintValue,
    DedSignatureProof,
)


@pytest.fixture
def config():
    return DedClientConfig(
        base_url="http://localhost:8081",
        api_key="test-api-key",
    )


@pytest.fixture
def submission():
    return FingerprintSubmission(
        attestation=SignedFingerprint(
            content=FingerprintValue(
                org_id="550e8400-e29b-41d4-a716-446655440000",
                tenant_id="123e4567-e89b-12d3-a456-426614174000",
                event_id="7ca8c920-0ead-22e2-91c5-11d05fe540d9",
                document_id="doc-001",
                document_ref="a" * 64,
                timestamp="2024-01-15T10:30:00.000Z",
                version=1,
            ),
            proofs=[
                DedSignatureProof(
                    id="b" * 128,
                    signature="c" * 128,
                    algorithm="SECP256K1_RFC8785_V1",
                )
            ],
        )
    )


def _mock_response(data, status_code=200):
    """Create a mock httpx.Response."""
    response = httpx.Response(
        status_code=status_code,
        json=data,
        request=httpx.Request("GET", "http://test"),
    )
    return response


class TestFingerprintsApi:
    @pytest.mark.asyncio
    async def test_submit_sends_post_with_api_key(self, config, submission):
        async with DedClient(config) as client:
            response_data = [
                {"eventId": "abc", "hash": "def", "accepted": True, "errors": []}
            ]
            with patch.object(
                client._http._client,
                "request",
                new_callable=AsyncMock,
                return_value=_mock_response(response_data),
            ) as mock_req:
                result = await client.fingerprints.submit([submission])

                assert result == response_data
                call_kwargs = mock_req.call_args
                assert call_kwargs[0][0] == "POST"
                assert "/v1/fingerprints" in call_kwargs[0][1]
                assert call_kwargs[1]["headers"]["X-Api-Key"] == "test-api-key"

    @pytest.mark.asyncio
    async def test_submit_raises_on_error(self, config, submission):
        async with DedClient(config) as client:
            with patch.object(
                client._http._client,
                "request",
                new_callable=AsyncMock,
                return_value=_mock_response(
                    {"message": "Insufficient credits"}, status_code=402
                ),
            ):
                with pytest.raises(DedApiError) as exc_info:
                    await client.fingerprints.submit([submission])
                assert exc_info.value.status == 402

    @pytest.mark.asyncio
    async def test_get_by_hash_is_public(self, config):
        async with DedClient(config) as client:
            with patch.object(
                client._http._client,
                "request",
                new_callable=AsyncMock,
                return_value=_mock_response({"data": {"eventId": "abc"}}),
            ) as mock_req:
                await client.fingerprints.get_by_hash("abc123")

                call_kwargs = mock_req.call_args
                # Public endpoints should not have X-Api-Key
                headers = call_kwargs[1].get("headers") or {}
                assert "X-Api-Key" not in headers

    @pytest.mark.asyncio
    async def test_search_passes_query_params(self, config):
        async with DedClient(config) as client:
            with patch.object(
                client._http._client,
                "request",
                new_callable=AsyncMock,
                return_value=_mock_response(
                    {"data": [], "pagination": {"hasMore": False}}
                ),
            ) as mock_req:
                await client.fingerprints.search(
                    FingerprintSearchParams(document_id="doc-001", limit=5)
                )

                call_kwargs = mock_req.call_args
                params = call_kwargs[1].get("params", {})
                assert params["document_id"] == "doc-001"
                assert params["limit"] == "5"


class TestUpload:
    @pytest.mark.asyncio
    async def test_upload_sends_multipart_with_content_length(self, config, submission):
        doc_ref = submission.attestation.content.document_ref
        doc_bytes = b"PDF content here"
        documents = {doc_ref: DocumentInfo(data=doc_bytes, mime_type="application/pdf")}

        response_data = {
            "data": [
                {
                    "eventId": "abc",
                    "hash": "def",
                    "accepted": True,
                    "errors": [],
                    "document": {
                        "s3Key": "org/tenant/2024/01/abc",
                        "contentType": "application/pdf",
                        "fileSize": len(doc_bytes),
                        "uploadedAt": "2024-01-15T10:30:00Z",
                    },
                }
            ]
        }

        async with DedClient(config) as client:
            with patch.object(
                client._http._client,
                "request",
                new_callable=AsyncMock,
                return_value=_mock_response(response_data),
            ) as mock_req:
                result = await client.fingerprints.upload([submission], documents)

                assert result == response_data
                call_kwargs = mock_req.call_args
                assert call_kwargs[0][0] == "POST"
                assert "/v1/fingerprints/upload" in call_kwargs[0][1]

                headers = call_kwargs[1]["headers"]
                assert headers["X-Api-Key"] == "test-api-key"
                assert "multipart/form-data; boundary=" in headers["Content-Type"]

                # Verify the body contains per-part Content-Length headers
                body = call_kwargs[1]["content"]
                assert isinstance(body, bytes)
                assert b'name="fingerprints"' in body
                assert f'name="{doc_ref}"'.encode() in body
                assert b"Content-Length:" in body
                assert doc_bytes in body

    @pytest.mark.asyncio
    async def test_upload_rejects_unsupported_mime_type(self, config, submission):
        doc_ref = submission.attestation.content.document_ref
        documents = {doc_ref: DocumentInfo(data=b"data", mime_type="application/zip")}

        async with DedClient(config) as client:
            with pytest.raises(ValueError, match="Unsupported mime type"):
                await client.fingerprints.upload([submission], documents)

    @pytest.mark.asyncio
    async def test_upload_accepts_all_allowed_mime_types(self, config, submission):
        """Verify all 10 allowed MIME types pass validation."""
        from constellation_digital_evidence_sdk.network.fingerprints_api import ALLOWED_MIME_TYPES

        doc_ref = submission.attestation.content.document_ref
        response_data = {"data": [{"eventId": "abc", "hash": "def", "accepted": True, "errors": []}]}

        for mime in ALLOWED_MIME_TYPES:
            documents = {doc_ref: DocumentInfo(data=b"x", mime_type=mime)}
            async with DedClient(config) as client:
                with patch.object(
                    client._http._client,
                    "request",
                    new_callable=AsyncMock,
                    return_value=_mock_response(response_data),
                ):
                    result = await client.fingerprints.upload([submission], documents)
                    assert result["data"][0]["accepted"]


class TestBatchesApi:
    @pytest.mark.asyncio
    async def test_get_batch_is_public(self, config):
        async with DedClient(config) as client:
            with patch.object(
                client._http._client,
                "request",
                new_callable=AsyncMock,
                return_value=_mock_response({"data": {"batchId": "abc"}}),
            ) as mock_req:
                await client.batches.get("abc-uuid")

                call_kwargs = mock_req.call_args
                assert "/v1/batches/abc-uuid" in call_kwargs[0][1]
                headers = call_kwargs[1].get("headers") or {}
                assert "X-Api-Key" not in headers
