"""Tests for LocalWalletSigner."""

import pytest

from constellation_digital_evidence_sdk_x402.signer import LocalWalletSigner


# Well-known test private key (DO NOT use in production)
TEST_PRIVATE_KEY = "0x4c0883a69102937d6231471b5dbb6204fe512961708279f1d7b18a1f6e8e1b3a"
EXPECTED_ADDRESS = "0x021bf0eb6D0d5Ef40b77c162CDc474750cC3B765"


def test_local_wallet_signer_address():
    signer = LocalWalletSigner(TEST_PRIVATE_KEY)
    assert signer.address.lower() == EXPECTED_ADDRESS.lower()


@pytest.mark.asyncio
async def test_local_wallet_signer_signs_typed_data():
    signer = LocalWalletSigner(TEST_PRIVATE_KEY)

    domain = {
        "name": "USD Coin",
        "version": "2",
        "chainId": 84532,
        "verifyingContract": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    }
    types = {
        "TransferWithAuthorization": [
            {"name": "from", "type": "address"},
            {"name": "to", "type": "address"},
            {"name": "value", "type": "uint256"},
            {"name": "validAfter", "type": "uint256"},
            {"name": "validBefore", "type": "uint256"},
            {"name": "nonce", "type": "bytes32"},
        ],
    }
    message = {
        "from": signer.address,
        "to": "0x0000000000000000000000000000000000000001",
        "value": "20000",
        "validAfter": "0",
        "validBefore": "9999999999",
        "nonce": "0x" + "ab" * 32,
    }

    signature = await signer.sign_typed_data(domain, types, message)
    assert isinstance(signature, str)
    # EIP-712 signatures are 65 bytes = 130 hex chars
    sig_hex = signature.removeprefix("0x")
    assert len(sig_hex) == 130


@pytest.mark.asyncio
async def test_different_messages_produce_different_signatures():
    signer = LocalWalletSigner(TEST_PRIVATE_KEY)

    domain = {
        "name": "USD Coin",
        "version": "2",
        "chainId": 84532,
        "verifyingContract": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    }
    types = {
        "TransferWithAuthorization": [
            {"name": "from", "type": "address"},
            {"name": "to", "type": "address"},
            {"name": "value", "type": "uint256"},
            {"name": "validAfter", "type": "uint256"},
            {"name": "validBefore", "type": "uint256"},
            {"name": "nonce", "type": "bytes32"},
        ],
    }
    base_message = {
        "from": signer.address,
        "to": "0x0000000000000000000000000000000000000001",
        "value": "20000",
        "validAfter": "0",
        "validBefore": "9999999999",
    }

    sig1 = await signer.sign_typed_data(
        domain, types, {**base_message, "nonce": "0x" + "aa" * 32}
    )
    sig2 = await signer.sign_typed_data(
        domain, types, {**base_message, "nonce": "0x" + "bb" * 32}
    )
    assert sig1 != sig2
