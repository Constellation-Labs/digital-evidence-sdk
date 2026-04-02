"""Tests for x402 payment types and parsing."""

import base64
import json

from constellation_digital_evidence_sdk_x402.types import (
    PaymentOffer,
    PaymentRequired,
    PaymentResult,
    X402PaymentRequired,
    parse_payment_required,
)


SAMPLE_402_BODY = {
    "x402Version": 2,
    "resource": {"url": "/v1/fingerprints", "description": "DED API: /v1/fingerprints"},
    "accepts": [
        {
            "scheme": "exact",
            "network": "eip155:84532",
            "amount": "20000",
            "asset": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
            "payTo": "0xRecipientAddress",
            "maxTimeoutSeconds": 60,
            "extra": {"name": "USD Coin", "version": "2"},
        }
    ],
}


def test_parse_payment_required_from_body():
    result = parse_payment_required(402, SAMPLE_402_BODY)
    assert result is not None
    assert result.x402_version == 2
    assert len(result.accepts) == 1
    offer = result.accepts[0]
    assert offer.scheme == "exact"
    assert offer.network == "eip155:84532"
    assert offer.amount == "20000"
    assert offer.asset == "0x036CbD53842c5426634e7929541eC2318f3dCF7e"
    assert offer.pay_to == "0xRecipientAddress"
    assert offer.max_timeout_seconds == 60
    assert offer.extra == {"name": "USD Coin", "version": "2"}


def test_parse_payment_required_from_header():
    encoded = base64.b64encode(json.dumps(SAMPLE_402_BODY).encode()).decode()
    result = parse_payment_required(402, {}, {"X-PAYMENT-REQUIRED": encoded})
    assert result is not None
    assert result.x402_version == 2
    assert result.accepts[0].pay_to == "0xRecipientAddress"


def test_parse_payment_required_returns_none_for_non_402():
    result = parse_payment_required(200, SAMPLE_402_BODY)
    assert result is None


def test_parse_payment_required_returns_none_for_empty_body():
    result = parse_payment_required(402, {"error": "something"})
    assert result is None


def test_payment_result_kind():
    r = PaymentResult(data={"foo": "bar"})
    assert r.kind == "result"
    assert r.data == {"foo": "bar"}


def test_payment_required_kind():
    pr = X402PaymentRequired(x402_version=2, resource={}, accepts=[])
    r = PaymentRequired(pr)
    assert r.kind == "payment_required"
    assert r.payment is pr
