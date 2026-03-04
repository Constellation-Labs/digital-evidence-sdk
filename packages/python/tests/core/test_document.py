"""Tests for document hashing."""

from constellation_digital_evidence_sdk.core.document import hash_document


def test_hash_string_produces_64_char_hex():
    result = hash_document("hello world")
    assert len(result) == 64
    assert all(c in "0123456789abcdef" for c in result)


def test_hash_empty_string():
    result = hash_document("")
    assert result == "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"


def test_hash_consistent():
    a = hash_document("test document content")
    b = hash_document("test document content")
    assert a == b


def test_hash_bytes_matches_string():
    from_bytes = hash_document(b"hello world")
    from_string = hash_document("hello world")
    assert from_bytes == from_string


def test_hash_different_inputs():
    a = hash_document("document A")
    b = hash_document("document B")
    assert a != b


def test_hash_sample_document():
    result = hash_document("This is a sample document for testing.")
    assert result == "952e76e23e01ad25b1ae3fb7298f2d35898dc6ebad49e5f170b9e65c1fa5d569"
