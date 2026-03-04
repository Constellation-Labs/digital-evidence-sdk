"""Cross-language test vectors — verify Python produces same output as TypeScript."""

import json
from pathlib import Path

from constellation_sdk import canonicalize, get_public_key_id, hash_data, verify_hash

from constellation_digital_evidence_sdk.core.document import hash_document
from constellation_digital_evidence_sdk.core.fingerprint import sign_fingerprint
from constellation_digital_evidence_sdk.core.metadata import compute_metadata_hash, create_metadata
from constellation_digital_evidence_sdk.core.types import FingerprintValue

VECTORS_PATH = Path(__file__).parent.parent.parent.parent.parent / "shared" / "test_vectors" / "fingerprint_vectors.json"
VECTORS = json.loads(VECTORS_PATH.read_text())


def _get_vector(name: str) -> dict:
    return next(v for v in VECTORS["vectors"] if v["name"] == name)


def _value_from_dict(d: dict) -> FingerprintValue:
    return FingerprintValue(
        org_id=d["orgId"],
        tenant_id=d["tenantId"],
        event_id=d["eventId"],
        document_id=d["documentId"],
        document_ref=d["documentRef"],
        timestamp=d["timestamp"],
        version=d["version"],
        signer_id=d.get("signerId"),
    )


class TestCrossLanguageVectors:
    def test_document_content_hash(self):
        v = _get_vector("basic_fingerprint_submission")
        result = hash_document(v["documentContent"])
        assert result == v["documentContentHash"]

    def test_canonical_field_order_no_signer(self):
        v = _get_vector("basic_fingerprint_submission")
        value = _value_from_dict(v["fingerprintValue"])
        canonical = canonicalize(value.to_dict())
        keys = list(json.loads(canonical).keys())
        assert keys == v["expectedCanonicalFields"]

    def test_canonical_field_order_with_signer(self):
        v = _get_vector("fingerprint_with_signer_id")
        pub_id = get_public_key_id(v["privateKey"])
        fp_dict = {**v["fingerprintValue"], "signerId": pub_id}
        value = _value_from_dict(fp_dict)
        canonical = canonicalize(value.to_dict())
        keys = list(json.loads(canonical).keys())
        assert keys == v["expectedCanonicalFields"]

    def test_verifiable_signature(self):
        v = _get_vector("basic_fingerprint_submission")
        value = _value_from_dict(v["fingerprintValue"])
        signed = sign_fingerprint(value, v["privateKey"])

        assert signed.content == value
        assert len(signed.proofs) == 1
        assert signed.proofs[0].algorithm == "SECP256K1_RFC8785_V1"

        value_hash = hash_data(value.to_dict())
        assert verify_hash(
            value_hash.value,
            signed.proofs[0].signature,
            signed.proofs[0].id,
        )

    def test_metadata_hash_deterministic(self):
        v = _get_vector("fingerprint_with_metadata")
        value = _value_from_dict(v["fingerprintValue"])
        h1 = compute_metadata_hash(value)
        h2 = compute_metadata_hash(value)
        assert h1 == h2
        assert len(h1) == 64

    def test_metadata_with_tags(self):
        v = _get_vector("fingerprint_with_metadata")
        value = _value_from_dict(v["fingerprintValue"])
        metadata = create_metadata(value, v["tags"])
        assert len(metadata.hash) == 64
        assert metadata.tags == v["tags"]
