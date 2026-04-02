"""EIP-712 domain construction and EIP-3009 TransferWithAuthorization signing."""

from __future__ import annotations

import base64
import json
import os
import time
from typing import Any

from .signer import X402Signer
from .types import PaymentOffer

# EIP-712 type definitions for EIP-3009 TransferWithAuthorization
TRANSFER_WITH_AUTHORIZATION_TYPES: dict[str, list[dict[str, str]]] = {
    "TransferWithAuthorization": [
        {"name": "from", "type": "address"},
        {"name": "to", "type": "address"},
        {"name": "value", "type": "uint256"},
        {"name": "validAfter", "type": "uint256"},
        {"name": "validBefore", "type": "uint256"},
        {"name": "nonce", "type": "bytes32"},
    ],
}


def build_eip3009_domain(offer: PaymentOffer) -> dict[str, Any]:
    """Build the EIP-712 domain from a payment offer.

    Extracts chainId from the CAIP-2 network identifier (e.g. "eip155:84532" -> 84532).
    """
    chain_id = int(offer.network.split(":")[1])
    return {
        "name": (offer.extra or {}).get("name", "USD Coin"),
        "version": (offer.extra or {}).get("version", "2"),
        "chainId": chain_id,
        "verifyingContract": offer.asset,
    }


def build_authorization(
    from_address: str,
    offer: PaymentOffer,
    valid_for_seconds: int = 300,
) -> dict[str, str]:
    """Build the TransferWithAuthorization message struct."""
    now = int(time.time())
    nonce = "0x" + os.urandom(32).hex()
    return {
        "from": from_address,
        "to": offer.pay_to,
        "value": str(offer.amount),
        "validAfter": "0",
        "validBefore": str(now + valid_for_seconds),
        "nonce": nonce,
    }


async def sign_payment(
    signer: X402Signer,
    offer: PaymentOffer,
    valid_for_seconds: int = 300,
) -> str:
    """Sign an x402 payment and return the base64-encoded X-PAYMENT header value.

    Performs the full EIP-3009 TransferWithAuthorization signing flow:
    1. Build EIP-712 domain from offer
    2. Build authorization message
    3. Sign with signer
    4. Encode PaymentPayload as base64 JSON
    """
    domain = build_eip3009_domain(offer)
    authorization = build_authorization(signer.address, offer, valid_for_seconds)
    signature = await signer.sign_typed_data(
        domain, TRANSFER_WITH_AUTHORIZATION_TYPES, authorization
    )

    payment_payload = {
        "x402Version": 2,
        "accepted": {
            "scheme": offer.scheme,
            "network": offer.network,
            "amount": str(offer.amount),
            "asset": offer.asset,
            "payTo": offer.pay_to,
            "maxTimeoutSeconds": offer.max_timeout_seconds,
            "extra": offer.extra or {},
        },
        "payload": {
            "signature": signature,
            "authorization": authorization,
        },
    }

    encoded = base64.b64encode(
        json.dumps(payment_payload).encode("utf-8")
    ).decode("ascii")
    return encoded
