import { DedClient } from '../../src/network/index';
import { generateFingerprint, generateKeyPair, hashDocument } from '../../src/core/index';

const mockFetch = jest.fn();
global.fetch = mockFetch;

const client = new DedClient({
  baseUrl: 'http://localhost:8081',
  apiKey: 'test-api-key',
});

beforeEach(() => {
  mockFetch.mockReset();
});

describe('upload file via SDK', () => {
  it('should generate a fingerprint from document content and upload it', async () => {
    const keyPair = generateKeyPair();
    const documentContent = 'This is a test document for upload.';
    const documentRef = hashDocument(documentContent);

    const submission = await generateFingerprint(
      {
        orgId: '550e8400-e29b-41d4-a716-446655440000',
        tenantId: '123e4567-e89b-12d3-a456-426614174000',
        eventId: '7ca8c920-0ead-22e2-91c5-11d05fe540d9',
        documentId: 'upload-doc-001',
        documentRef,
        includeMetadata: true,
        tags: { source: 'test', type: 'plain-text' },
      },
      keyPair.privateKey
    );

    const documents = new Map([
      [documentRef, { blob: new Blob([documentContent]), mimeType: 'text/plain' as const }],
    ]);

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve([
          {
            eventId: submission.attestation.content.eventId,
            hash: documentRef,
            accepted: true,
            document: {
              s3Key: `uploads/${documentRef}`,
              contentType: 'text/plain',
              fileSize: documentContent.length,
              uploadedAt: new Date().toISOString(),
            },
            errors: [],
          },
        ]),
    });

    const results = await client.fingerprints.upload([submission], documents);

    expect(results).toHaveLength(1);
    expect(results[0].accepted).toBe(true);
    expect(results[0].document).toBeDefined();
    expect(results[0].document!.contentType).toBe('text/plain');

    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe('http://localhost:8081/v1/fingerprints/upload');
    expect(options.method).toBe('POST');
    expect(options.headers['X-Api-Key']).toBe('test-api-key');
    expect(options.body).toBeInstanceOf(FormData);

    const formData: FormData = options.body;
    expect(formData.has('fingerprints')).toBe(true);
    expect(formData.has(documentRef)).toBe(true);
  });

  it('should upload a PDF document', async () => {
    const keyPair = generateKeyPair();
    const pdfContent = new Uint8Array([0x25, 0x50, 0x44, 0x46]); // %PDF magic bytes
    const documentRef = hashDocument(pdfContent);

    const submission = await generateFingerprint(
      {
        orgId: '550e8400-e29b-41d4-a716-446655440000',
        tenantId: '123e4567-e89b-12d3-a456-426614174000',
        eventId: 'aabbccdd-0000-1111-2222-333344445555',
        documentId: 'upload-doc-pdf',
        documentRef,
      },
      keyPair.privateKey
    );

    const documents = new Map([
      [documentRef, { blob: new Blob([pdfContent]), mimeType: 'application/pdf' as const }],
    ]);

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve([
          {
            eventId: submission.attestation.content.eventId,
            hash: documentRef,
            accepted: true,
            document: {
              s3Key: `uploads/${documentRef}`,
              contentType: 'application/pdf',
              fileSize: pdfContent.length,
              uploadedAt: new Date().toISOString(),
            },
            errors: [],
          },
        ]),
    });

    const results = await client.fingerprints.upload([submission], documents);

    expect(results).toHaveLength(1);
    expect(results[0].accepted).toBe(true);
    expect(results[0].document!.contentType).toBe('application/pdf');
  });

  it('should upload multiple documents in a single call', async () => {
    const keyPair = generateKeyPair();

    const docs = [
      { content: 'Document one', id: 'doc-1', mime: 'text/plain' },
      { content: '{"key": "value"}', id: 'doc-2', mime: 'application/json' },
    ];

    const submissions = await Promise.all(
      docs.map((doc) => {
        const ref = hashDocument(doc.content);
        return generateFingerprint(
          {
            orgId: '550e8400-e29b-41d4-a716-446655440000',
            tenantId: '123e4567-e89b-12d3-a456-426614174000',
            eventId: crypto.randomUUID(),
            documentId: doc.id,
            documentRef: ref,
          },
          keyPair.privateKey
        );
      })
    );

    const documents = new Map(
      docs.map((doc) => [
        hashDocument(doc.content),
        { blob: new Blob([doc.content]), mimeType: doc.mime },
      ])
    );

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve(
          submissions.map((s) => ({
            eventId: s.attestation.content.eventId,
            hash: s.attestation.content.documentRef,
            accepted: true,
            document: {
              s3Key: `uploads/${s.attestation.content.documentRef}`,
              contentType: 'text/plain',
              fileSize: 10,
              uploadedAt: new Date().toISOString(),
            },
            errors: [],
          }))
        ),
    });

    const results = await client.fingerprints.upload(submissions, documents);

    expect(results).toHaveLength(2);
    expect(results.every((r) => r.accepted)).toBe(true);

    const formData: FormData = mockFetch.mock.calls[0][1].body;
    expect(formData.has('fingerprints')).toBe(true);
    for (const doc of docs) {
      expect(formData.has(hashDocument(doc.content))).toBe(true);
    }
  });

  it('should reject unsupported mime types', async () => {
    const keyPair = generateKeyPair();
    const submission = await generateFingerprint(
      {
        orgId: '550e8400-e29b-41d4-a716-446655440000',
        tenantId: '123e4567-e89b-12d3-a456-426614174000',
        eventId: 'aabbccdd-0000-1111-2222-333344445555',
        documentId: 'bad-doc',
        documentContent: 'test',
      },
      keyPair.privateKey
    );

    const documents = new Map([
      ['some-ref', { blob: new Blob(['test']), mimeType: 'application/zip' }],
    ]);

    await expect(client.fingerprints.upload([submission], documents)).rejects.toThrow(
      'Unsupported mime type "application/zip"'
    );
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
