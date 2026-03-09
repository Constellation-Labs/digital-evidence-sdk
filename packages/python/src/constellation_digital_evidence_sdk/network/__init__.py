"""Network module for interacting with the DED Ingestion API."""

from .http_client import DedApiError, DedHttpClient
from .fingerprints_api import FingerprintsApi
from .batches_api import BatchesApi
from .types import (
    DedClientConfig,
    DataResponse,
    PaginatedResponse,
    FingerprintDetail,
    FingerprintProof,
    FingerprintSearchParams,
    FingerprintStatus,
    BatchDetail,
    PlatformStats,
    DocumentInfo,
    DocumentUploadResultItem,
)


class DedClient:
    """Main entry point for DED API interactions.

    Example::

        from constellation_digital_evidence_sdk.network import DedClient

        client = DedClient(DedClientConfig(
            base_url="http://localhost:8081",
            api_key="your-api-key",
        ))

        # Submit fingerprints
        results = await client.fingerprints.submit(submissions)

        # Look up by hash (public)
        detail = await client.fingerprints.get_by_hash(hash_value)
    """

    def __init__(self, config: DedClientConfig) -> None:
        http = DedHttpClient(config)
        self.fingerprints = FingerprintsApi(http)
        self.batches = BatchesApi(http)
        self._http = http

    async def close(self) -> None:
        """Close the underlying HTTP client."""
        await self._http.close()

    async def __aenter__(self) -> "DedClient":
        return self

    async def __aexit__(self, *args: object) -> None:
        await self.close()


__all__ = [
    "DedClient",
    "DedHttpClient",
    "DedApiError",
    "FingerprintsApi",
    "BatchesApi",
    "DedClientConfig",
    "DataResponse",
    "PaginatedResponse",
    "FingerprintDetail",
    "FingerprintProof",
    "FingerprintSearchParams",
    "FingerprintStatus",
    "BatchDetail",
    "PlatformStats",
    "DocumentInfo",
    "DocumentUploadResultItem",
]
