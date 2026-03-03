import { hashDocument } from '../../src/core/document';

describe('hashDocument', () => {
  it('should produce a 64-character hex SHA-256 hash from a string', () => {
    const result = hashDocument('hello world');
    expect(result).toHaveLength(64);
    expect(result).toMatch(/^[0-9a-f]+$/);
  });

  it('should produce the known SHA-256 for empty string', () => {
    // SHA-256 of empty string is a well-known constant
    const result = hashDocument('');
    expect(result).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });

  it('should produce consistent results for same input', () => {
    const a = hashDocument('test document content');
    const b = hashDocument('test document content');
    expect(a).toBe(b);
  });

  it('should accept Uint8Array input', () => {
    const bytes = new TextEncoder().encode('hello world');
    const fromBytes = hashDocument(bytes);
    const fromString = hashDocument('hello world');
    expect(fromBytes).toBe(fromString);
  });

  it('should produce different hashes for different inputs', () => {
    const a = hashDocument('document A');
    const b = hashDocument('document B');
    expect(a).not.toBe(b);
  });

  it('should match the test vector for sample document', () => {
    const result = hashDocument('This is a sample document for testing.');
    expect(result).toBe('952e76e23e01ad25b1ae3fb7298f2d35898dc6ebad49e5f170b9e65c1fa5d569');
  });
});
