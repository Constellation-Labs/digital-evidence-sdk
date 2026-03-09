import { DedClient } from '../../src/network/index';
import { generateFingerprint, generateKeyPair, hashDocument } from '../../src/core/index';

const mockFetch = jest.fn();
global.fetch = mockFetch;

const client = new DedClient({
  baseUrl: 'http://localhost:8081',
  apiKey: 'test-api-key',
});

const orgId = '550e8400-e29b-41d4-a716-446655440000';
const tenantId = '123e4567-e89b-12d3-a456-426614174000';

beforeEach(() => {
  mockFetch.mockReset();
});

function mockUploadResponse(
  items: Array<{ eventId: string; hash: string; contentType: string; fileSize: number }>
) {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: () =>
      Promise.resolve({
        data: items.map((item) => ({
          eventId: item.eventId,
          hash: item.hash,
          accepted: true,
          document: {
            s3Key: `uploads/${item.hash}`,
            contentType: item.contentType,
            fileSize: item.fileSize,
            uploadedAt: '2025-01-15T10:30:00.000Z',
          },
          errors: [],
        })),
      }),
  });
}

describe('upload file via SDK', () => {
  it('should upload a text document', async () => {
    const keyPair = generateKeyPair();
    const documentContent = 'This is a test document for upload.';
    const documentRef = hashDocument(documentContent);

    const submission = await generateFingerprint(
      {
        orgId,
        tenantId,
        eventId: crypto.randomUUID(),
        documentId: 'upload-doc-001',
        documentRef,
        includeMetadata: true,
        tags: { source: 'test', type: 'plain-text' },
      },
      keyPair.privateKey
    );

    const documents = new Map([
      [documentRef, { blob: new Blob([documentContent]), mimeType: 'text/plain' }],
    ]);

    mockUploadResponse([
      {
        eventId: submission.attestation.content.eventId,
        hash: documentRef,
        contentType: 'text/plain',
        fileSize: documentContent.length,
      },
    ]);

    const response = await client.fingerprints.upload([submission], documents);

    expect(response.data).toHaveLength(1);
    expect(response.data[0].eventId).toBe(submission.attestation.content.eventId);
    expect(response.data[0].accepted).toBe(true);
    expect(response.data[0].document).toBeDefined();
    expect(response.data[0].document!.contentType).toBe('text/plain');

    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe('http://localhost:8081/v1/fingerprints/upload');
    expect(options.method).toBe('POST');
    expect(options.headers['X-Api-Key']).toBe('test-api-key');
    expect(options.body).toBeInstanceOf(Uint8Array);
    expect(options.headers['Content-Type']).toMatch(/^multipart\/form-data; boundary=/);

    // Verify multipart body contains expected parts with Content-Length headers
    const bodyText = new TextDecoder().decode(options.body);
    expect(bodyText).toContain('name="fingerprints"');
    expect(bodyText).toContain(`name="${documentRef}"`);
    expect(bodyText).toContain('Content-Length:');
  });

  it('should upload a PDF document', async () => {
    const keyPair = generateKeyPair();
    const pdfContent = new Uint8Array([0x25, 0x50, 0x44, 0x46]); // %PDF magic bytes
    const documentRef = hashDocument(pdfContent);

    const submission = await generateFingerprint(
      {
        orgId,
        tenantId,
        eventId: crypto.randomUUID(),
        documentId: 'upload-doc-pdf',
        documentRef,
      },
      keyPair.privateKey
    );

    const documents = new Map([
      [documentRef, { blob: new Blob([pdfContent]), mimeType: 'application/pdf' }],
    ]);

    mockUploadResponse([
      {
        eventId: submission.attestation.content.eventId,
        hash: documentRef,
        contentType: 'application/pdf',
        fileSize: pdfContent.length,
      },
    ]);

    const response = await client.fingerprints.upload([submission], documents);

    expect(response.data).toHaveLength(1);
    expect(response.data[0].accepted).toBe(true);
    expect(response.data[0].document!.contentType).toBe('application/pdf');
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
            orgId,
            tenantId,
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

    mockUploadResponse(
      docs.map((doc, i) => ({
        eventId: submissions[i].attestation.content.eventId,
        hash: hashDocument(doc.content),
        contentType: doc.mime,
        fileSize: doc.content.length,
      }))
    );

    const response = await client.fingerprints.upload(submissions, documents);

    expect(response.data).toHaveLength(2);
    expect(response.data.every((r) => r.accepted)).toBe(true);

    const bodyText = new TextDecoder().decode(mockFetch.mock.calls[0][1].body);
    for (const doc of docs) {
      expect(bodyText).toContain(`name="${hashDocument(doc.content)}"`);
    }
  });

  it('should reject unsupported mime types', async () => {
    const keyPair = generateKeyPair();
    const submission = await generateFingerprint(
      {
        orgId,
        tenantId,
        eventId: crypto.randomUUID(),
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
