"""Tests for fingerprint creation and signing."""

import pytest

from constellation_sdk import generate_key_pair, get_public_key_id, hash_data, verify_hash

from constellation_digital_evidence_sdk.core.fingerprint import (
    create_fingerprint_value,
    sign_fingerprint,
    generate_fingerprint,
    FingerprintGenerator,
)
from constellation_digital_evidence_sdk.core.errors import SigningError
from constellation_digital_evidence_sdk.core.types import GenerateOptions


BASE_OPTIONS = GenerateOptions(
    org_id="550e8400-e29b-41d4-a716-446655440000",
    tenant_id="123e4567-e89b-12d3-a456-426614174000",
    event_id="7ca8c920-0ead-22e2-91c5-11d05fe540d9",
    document_id="contract-2024-001",
    document_ref="e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
)


class TestCreateFingerprintValue:
    def test_creates_value_with_required_fields(self):
        value = create_fingerprint_value(BASE_OPTIONS)
        assert value.org_id == BASE_OPTIONS.org_id
        assert value.tenant_id == BASE_OPTIONS.tenant_id
        assert value.event_id == BASE_OPTIONS.event_id
        assert value.document_id == BASE_OPTIONS.document_id
        assert value.document_ref == BASE_OPTIONS.document_ref
        assert value.version == 1
        assert value.timestamp is not None
        assert value.signer_id is None

    def test_includes_signer_id(self):
        kp = generate_key_pair()
        pub_id = get_public_key_id(kp.private_key)
        value = create_fingerprint_value(BASE_OPTIONS, pub_id)
        assert value.signer_id == pub_id
        assert len(value.signer_id) == 128

    def test_computes_document_ref_from_content(self):
        opts = GenerateOptions(
            org_id=BASE_OPTIONS.org_id,
            tenant_id=BASE_OPTIONS.tenant_id,
            event_id=BASE_OPTIONS.event_id,
            document_id=BASE_OPTIONS.document_id,
            document_content="test content",
        )
        value = create_fingerprint_value(opts)
        assert len(value.document_ref) == 64

    def test_raises_without_ref_or_content(self):
        opts = GenerateOptions(
            org_id=BASE_OPTIONS.org_id,
            tenant_id=BASE_OPTIONS.tenant_id,
            event_id=BASE_OPTIONS.event_id,
            document_id=BASE_OPTIONS.document_id,
        )
        with pytest.raises(SigningError, match="document_ref or document_content"):
            create_fingerprint_value(opts)


class TestSignFingerprint:
    def test_produces_signed_fingerprint(self):
        kp = generate_key_pair()
        value = create_fingerprint_value(BASE_OPTIONS)
        signed = sign_fingerprint(value, kp.private_key)

        assert signed.content == value
        assert len(signed.proofs) == 1
        assert signed.proofs[0].algorithm == "SECP256K1_RFC8785_V1"
        assert len(signed.proofs[0].id) == 128

    def test_signature_is_verifiable(self):
        kp = generate_key_pair()
        value = create_fingerprint_value(BASE_OPTIONS)
        signed = sign_fingerprint(value, kp.private_key)
        proof = signed.proofs[0]

        value_hash = hash_data(value.to_dict())
        assert verify_hash(value_hash.value, proof.signature, proof.id)


class TestGenerateFingerprint:
    def test_produces_complete_submission(self):
        kp = generate_key_pair()
        opts = GenerateOptions(
            org_id="550e8400-e29b-41d4-a716-446655440000",
            tenant_id="123e4567-e89b-12d3-a456-426614174000",
            event_id="7ca8c920-0ead-22e2-91c5-11d05fe540d9",
            document_id="contract-2024-001",
            document_content="test document content",
        )
        submission = generate_fingerprint(opts, kp.private_key)

        assert submission.attestation is not None
        assert len(submission.attestation.proofs) == 1
        assert submission.attestation.content.signer_id == get_public_key_id(
            kp.private_key
        )
        assert submission.metadata is None

    def test_includes_metadata_with_tags(self):
        kp = generate_key_pair()
        tags = {"department": "legal", "priority": "high"}
        opts = GenerateOptions(
            org_id="550e8400-e29b-41d4-a716-446655440000",
            tenant_id="123e4567-e89b-12d3-a456-426614174000",
            event_id="7ca8c920-0ead-22e2-91c5-11d05fe540d9",
            document_id="contract-2024-001",
            document_content="test document content",
            tags=tags,
        )
        submission = generate_fingerprint(opts, kp.private_key)

        assert submission.metadata is not None
        assert submission.metadata.tags == tags


class TestFingerprintGenerator:
    def test_generates_with_defaults(self):
        kp = generate_key_pair()
        gen = FingerprintGenerator(
            private_key=kp.private_key,
            org_id="550e8400-e29b-41d4-a716-446655440000",
            tenant_id="123e4567-e89b-12d3-a456-426614174000",
        )
        opts = GenerateOptions(
            org_id="",
            tenant_id="",
            event_id="7ca8c920-0ead-22e2-91c5-11d05fe540d9",
            document_id="contract-2024-001",
            document_content="test content",
        )
        submission = gen.generate(opts)
        assert submission.attestation.content.org_id == "550e8400-e29b-41d4-a716-446655440000"

    def test_exposes_public_key_id(self):
        kp = generate_key_pair()
        gen = FingerprintGenerator(private_key=kp.private_key)
        assert gen.public_key_id == get_public_key_id(kp.private_key)
