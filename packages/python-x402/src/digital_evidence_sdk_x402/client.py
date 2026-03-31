"""Top-level x402 DED client."""

from __future__ import annotations

from constellation_digital_evidence_sdk.core.fingerprint import (
    FingerprintGenerator,
    generate_fingerprint,
)
from constellation_digital_evidence_sdk.core.types import (
    FingerprintSubmission,
    GenerateOptions,
)
from constellation_digital_evidence_sdk.core.wallet_uuid import (
    org_id_from_wallet,
    tenant_id_from_wallet,
)
from constellation_digital_evidence_sdk.network.batches_api import BatchesApi

from .fingerprints_api import X402FingerprintsApi
from .http_client import X402HttpClient
from .signer import LocalWalletSigner, X402Signer
from .types import X402Config


class DedX402Client:
    """x402 pay-per-request client for the DED API.

    Uses an Ethereum wallet to sign EIP-3009 TransferWithAuthorization
    payments instead of API key authentication.

    Organization and tenant IDs are deterministically derived from the
    wallet address (UUID v5), so no prior registration is required.

    Example::

        async with DedX402Client(X402Config(
            base_url="https://de-api.constellationnetwork.io",
            wallet_private_key="0xabc...",
            signing_private_key="deadbeef...",
        )) as client:
            # Generate a fingerprint with wallet-derived org/tenant IDs
            submission = client.generate_fingerprint(GenerateOptions(
                org_id="",  # auto-filled from wallet
                tenant_id="",  # auto-filled from wallet
                event_id="evt-1",
                document_id="doc-1",
                document_content="Hello, world!",
            ))
            results = await client.fingerprints.submit([submission])
    """

    fingerprints: X402FingerprintsApi
    batches: BatchesApi

    def __init__(
        self,
        config: X402Config,
        signer: X402Signer | None = None,
    ) -> None:
        if signer is None:
            signer = LocalWalletSigner(config.wallet_private_key)

        self._signer = signer
        self._config = config
        self._http = X402HttpClient(config, signer)
        self.fingerprints = X402FingerprintsApi(self._http)
        self.batches = BatchesApi(self._http)  # type: ignore[arg-type]

        # Derive org/tenant IDs from wallet address
        self.org_id = org_id_from_wallet(signer.address)
        self.tenant_id = tenant_id_from_wallet(signer.address)

        # Create a FingerprintGenerator with wallet-derived defaults
        self._generator: FingerprintGenerator | None = None
        if config.signing_private_key:
            self._generator = FingerprintGenerator(
                private_key=config.signing_private_key,
                org_id=self.org_id,
                tenant_id=self.tenant_id,
            )

    def generate_fingerprint(self, options: GenerateOptions) -> FingerprintSubmission:
        """Generate a fingerprint submission with wallet-derived org/tenant IDs.

        Automatically fills in ``org_id`` and ``tenant_id`` from the wallet address
        if not already set in the options.

        Requires ``signing_private_key`` to be set in ``X402Config``.

        Args:
            options: Fingerprint generation options. ``org_id`` and ``tenant_id``
                     are auto-populated from the wallet if left empty.

        Returns:
            A complete FingerprintSubmission ready for ``client.fingerprints.submit()``.

        Raises:
            ValueError: If ``signing_private_key`` was not provided in config.
        """
        if self._generator is None:
            raise ValueError(
                "signing_private_key must be set in X402Config to generate fingerprints"
            )

        merged = GenerateOptions(
            org_id=options.org_id or self.org_id,
            tenant_id=options.tenant_id or self.tenant_id,
            event_id=options.event_id,
            document_id=options.document_id,
            document_ref=options.document_ref,
            document_content=options.document_content,
            timestamp=options.timestamp,
            version=options.version,
            include_metadata=options.include_metadata,
            tags=options.tags,
        )
        return self._generator.generate(merged)

    @property
    def wallet_address(self) -> str:
        """The Ethereum wallet address used for payments."""
        return self._signer.address

    async def close(self) -> None:
        """Close the underlying HTTP client."""
        await self._http.close()

    async def __aenter__(self) -> DedX402Client:
        return self

    async def __aexit__(self, *args: object) -> None:
        await self.close()
