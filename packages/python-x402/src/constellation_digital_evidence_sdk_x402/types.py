"""x402 payment types for the DED SDK."""

from __future__ import annotations

import base64
import json
from dataclasses import dataclass, field
from typing import Any, Generic, Literal, TypeVar, Union

T = TypeVar("T")


@dataclass(frozen=True)
class PaymentOffer:
    """A single accepted payment option from a 402 response."""

    scheme: str
    network: str
    amount: str
    asset: str
    pay_to: str
    max_timeout_seconds: int
    extra: dict[str, str] | None = None


@dataclass(frozen=True)
class X402PaymentRequired:
    """Parsed HTTP 402 response body."""

    x402_version: int
    resource: dict[str, str]
    accepts: list[PaymentOffer]


@dataclass(frozen=True)
class X402Config:
    """Configuration for the x402 DED client."""

    base_url: str
    wallet_private_key: str
    signing_private_key: str = ""
    timeout: float = 30.0
    auto_pay: bool = True


@dataclass(frozen=True)
class PaymentResult(Generic[T]):
    """Successful result from a paid endpoint."""

    kind: Literal["result"] = field(default="result", init=False)
    data: T = field(default=None)  # type: ignore[assignment]

    def __init__(self, data: T) -> None:
        object.__setattr__(self, "data", data)


@dataclass(frozen=True)
class PaymentRequired:
    """Payment required — returned when auto_pay=False."""

    kind: Literal["payment_required"] = field(default="payment_required", init=False)
    payment: X402PaymentRequired = field(default=None)  # type: ignore[assignment]

    def __init__(self, payment: X402PaymentRequired) -> None:
        object.__setattr__(self, "payment", payment)


PaymentOr = Union[PaymentResult[T], PaymentRequired]


def parse_payment_required(
    status_code: int, body: Any, headers: dict[str, str] | None = None
) -> X402PaymentRequired | None:
    """Parse x402 payment info from a 402 response.

    Tries the JSON body first, falls back to X-PAYMENT-REQUIRED header.
    """
    if status_code != 402:
        return None

    # Try body
    if isinstance(body, dict) and "accepts" in body:
        return _parse_body(body)

    # Fallback: X-PAYMENT-REQUIRED header (base64 JSON)
    if headers:
        raw = headers.get("X-PAYMENT-REQUIRED") or headers.get("x-payment-required")
        if raw:
            decoded = json.loads(base64.b64decode(raw))
            return _parse_body(decoded)

    return None


def _parse_body(body: dict[str, Any]) -> X402PaymentRequired:
    accepts = []
    for item in body.get("accepts", []):
        accepts.append(
            PaymentOffer(
                scheme=item.get("scheme", "exact"),
                network=item["network"],
                amount=str(item["amount"]),
                asset=item["asset"],
                pay_to=item["payTo"],
                max_timeout_seconds=item.get("maxTimeoutSeconds", 60),
                extra=item.get("extra"),
            )
        )
    return X402PaymentRequired(
        x402_version=body.get("x402Version", 2),
        resource=body.get("resource", {}),
        accepts=accepts,
    )
