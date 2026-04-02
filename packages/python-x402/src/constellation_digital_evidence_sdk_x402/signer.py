"""x402 signer protocol and local wallet implementation."""

from __future__ import annotations

from typing import Any, Protocol, runtime_checkable

from eth_account import Account
from eth_account.messages import encode_typed_data


@runtime_checkable
class X402Signer(Protocol):
    """Abstract signer for x402 payments.

    Implement this protocol to use hardware wallets, KMS, or other signing backends.
    """

    @property
    def address(self) -> str: ...

    async def sign_typed_data(
        self,
        domain: dict[str, Any],
        types: dict[str, list[dict[str, str]]],
        message: dict[str, Any],
    ) -> str:
        """Sign EIP-712 typed data, return hex signature string."""
        ...


class LocalWalletSigner:
    """Signs EIP-712 typed data using a local Ethereum private key via eth-account."""

    def __init__(self, private_key: str) -> None:
        self._private_key = private_key
        acct = Account.from_key(private_key)
        self._address: str = acct.address

    @property
    def address(self) -> str:
        return self._address

    async def sign_typed_data(
        self,
        domain: dict[str, Any],
        types: dict[str, list[dict[str, str]]],
        message: dict[str, Any],
    ) -> str:
        """Sign EIP-712 typed data and return the hex signature."""
        signable = encode_typed_data(
            domain_data=domain,
            message_types=types,
            message_data=message,
        )
        signed = Account.sign_message(signable, self._private_key)
        return "0x" + signed.signature.hex()
