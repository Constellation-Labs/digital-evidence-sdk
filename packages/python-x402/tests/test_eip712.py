"""Tests for EIP-712 domain construction and authorization building."""

import time

from digital_evidence_sdk_x402.eip712 import (
    build_authorization,
    build_eip3009_domain,
)
from digital_evidence_sdk_x402.types import PaymentOffer


def _make_offer(**overrides) -> PaymentOffer:
    defaults = {
        "scheme": "exact",
        "network": "eip155:84532",
        "amount": "20000",
        "asset": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
        "pay_to": "0xRecipient",
        "max_timeout_seconds": 60,
        "extra": {"name": "USD Coin", "version": "2"},
    }
    defaults.update(overrides)
    return PaymentOffer(**defaults)


def test_build_domain_extracts_chain_id():
    offer = _make_offer(network="eip155:84532")
    domain = build_eip3009_domain(offer)
    assert domain["chainId"] == 84532
    assert domain["verifyingContract"] == offer.asset
    assert domain["name"] == "USD Coin"
    assert domain["version"] == "2"


def test_build_domain_base_mainnet():
    offer = _make_offer(network="eip155:8453")
    domain = build_eip3009_domain(offer)
    assert domain["chainId"] == 8453


def test_build_domain_defaults_without_extra():
    offer = _make_offer(extra=None)
    domain = build_eip3009_domain(offer)
    assert domain["name"] == "USD Coin"
    assert domain["version"] == "2"


def test_build_authorization():
    offer = _make_offer()
    auth = build_authorization("0xSender", offer, valid_for_seconds=300)
    assert auth["from"] == "0xSender"
    assert auth["to"] == offer.pay_to
    assert auth["value"] == str(offer.amount)
    assert auth["validAfter"] == "0"
    assert auth["nonce"].startswith("0x")
    assert len(auth["nonce"]) == 66  # 0x + 64 hex chars

    valid_before = int(auth["validBefore"])
    now = int(time.time())
    assert valid_before >= now + 295  # allow small timing variance
    assert valid_before <= now + 305


def test_build_authorization_unique_nonces():
    offer = _make_offer()
    auth1 = build_authorization("0xSender", offer)
    auth2 = build_authorization("0xSender", offer)
    assert auth1["nonce"] != auth2["nonce"]
