import { randomUUID } from 'node:crypto';
import type {
  Config, FingerprintValue, SignedFingerprint,
  FingerprintSubmission, SignatureProof, StateRecord,
} from './types.js';
import { hashStateRecord, signFingerprint, computeMetadataHash, canonicalJson } from './crypto.js';
import type { Agent } from './types.js';

// ============================================================================
// DED API Client — thin wrapper using native fetch
// ============================================================================

export class DedClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly orgId: string;
  private readonly tenantId: string;
  private readonly dryRun: boolean;

  constructor(config: Config) {
    this.baseUrl = config.ded.baseUrl.replace(/\/$/, '');
    this.apiKey = config.ded.apiKey;
    this.orgId = config.ded.orgId;
    this.tenantId = config.ded.tenantId;
    this.dryRun = config.dryRun;
  }

  /**
   * Checkpoint a state record to DED.
   * Creates a fingerprint with documentRef = hash(stateRecord),
   * signed by the leader and co-signed by all active participants.
   */
  async checkpoint(
    stateRecord: StateRecord,
    instanceId: string,
    epoch: number,
    agents: Agent[],
  ): Promise<{ fingerprintHash: string; documentRef: string } | null> {
    const stateHash = hashStateRecord(stateRecord);

    const fingerprintValue: FingerprintValue = {
      orgId: this.orgId,
      tenantId: this.tenantId,
      eventId: randomUUID(),
      signerId: agents[0]!.publicKey,
      documentId: `poker:${instanceId}:epoch:${epoch}`,
      documentRef: stateHash,
      timestamp: new Date().toISOString(),
      version: 1,
    };

    // All agents co-sign the fingerprint
    const proofs: SignatureProof[] = agents.map(agent =>
      signFingerprint(fingerprintValue, agent.privateKey)
    );

    const signed: SignedFingerprint = {
      content: fingerprintValue,
      proofs,
    };

    const metadataHash = computeMetadataHash(fingerprintValue);

    const submission: FingerprintSubmission = {
      attestation: signed,
      metadata: {
        hash: metadataHash,
        tags: {
          protocol: 'poker-mpvsp',
          instance: instanceId.replace(/-/g, ''),
          epoch: String(epoch),
          hand: String(stateRecord.state.handNumber),
          phase: stateRecord.state.phase,
        },
      },
    };

    if (this.dryRun) {
      console.log(`  [DED DRY-RUN] Would submit fingerprint:`);
      console.log(`    documentId: ${fingerprintValue.documentId}`);
      console.log(`    documentRef: ${stateHash.slice(0, 16)}...`);
      console.log(`    signers: ${proofs.length} parties`);
      console.log(`    tags: ${JSON.stringify(submission.metadata?.tags)}`);
      return { fingerprintHash: metadataHash, documentRef: stateHash };
    }

    return this.submitFingerprint(submission);
  }

  /**
   * Upload a state diff document alongside a fingerprint checkpoint.
   */
  async uploadStateDiff(
    stateRecord: StateRecord,
    instanceId: string,
    epoch: number,
    agents: Agent[],
    diffPayload: string,
  ): Promise<{ fingerprintHash: string; documentRef: string } | null> {
    const diffHash = computeMetadataHash({
      orgId: this.orgId,
      tenantId: this.tenantId,
      eventId: randomUUID(),
      documentId: `poker:${instanceId}:diff:${epoch}`,
      documentRef: '',
      timestamp: new Date().toISOString(),
      version: 1,
    });

    if (this.dryRun) {
      console.log(`  [DED DRY-RUN] Would upload state diff:`);
      console.log(`    epoch: ${epoch}`);
      console.log(`    diff size: ${diffPayload.length} bytes`);
      return { fingerprintHash: diffHash, documentRef: diffHash };
    }

    // Use the /upload multipart endpoint
    const stateHash = hashStateRecord(stateRecord);
    const fingerprintValue: FingerprintValue = {
      orgId: this.orgId,
      tenantId: this.tenantId,
      eventId: randomUUID(),
      documentId: `poker:${instanceId}:diff:${epoch}`,
      documentRef: stateHash,
      timestamp: new Date().toISOString(),
      version: 1,
    };

    const proofs = agents.map(a => signFingerprint(fingerprintValue, a.privateKey));
    const signed: SignedFingerprint = { content: fingerprintValue, proofs };
    const metadataHash = computeMetadataHash(fingerprintValue);
    const submission: FingerprintSubmission = {
      attestation: signed,
      metadata: { hash: metadataHash },
    };

    return this.uploadWithDocument(submission, diffPayload, stateHash);
  }

  // --- Private HTTP methods ---

  private async submitFingerprint(
    submission: FingerprintSubmission
  ): Promise<{ fingerprintHash: string; documentRef: string } | null> {
    try {
      const res = await fetch(`${this.baseUrl}/v1/fingerprints`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Api-Key': this.apiKey,
        },
        body: JSON.stringify([submission]),
      });

      if (!res.ok) {
        const body = await res.text();
        console.error(`  [DED ERROR] ${res.status}: ${body}`);
        return null;
      }

      const result = await res.json() as Array<{ hash: string; accepted: boolean; errors: string[]; eventId: string }>;
      const first = result[0];
      if (!first?.accepted) {
        console.error(`  [DED REJECTED] ${first?.errors?.join(', ')}`);
        return null;
      }

      return {
        fingerprintHash: first.hash,
        documentRef: submission.attestation.content.documentRef,
      };
    } catch (err) {
      console.error(`  [DED ERROR] ${err instanceof Error ? err.message : err}`);
      return null;
    }
  }

  private async uploadWithDocument(
    submission: FingerprintSubmission,
    document: string,
    documentRef: string,
  ): Promise<{ fingerprintHash: string; documentRef: string } | null> {
    try {
      const formData = new FormData();
      formData.append(
        'fingerprints',
        new Blob([JSON.stringify([submission])], { type: 'application/json' })
      );
      formData.append(
        documentRef,
        new Blob([document], { type: 'application/json' })
      );

      const res = await fetch(`${this.baseUrl}/v1/fingerprints/upload`, {
        method: 'POST',
        headers: { 'X-Api-Key': this.apiKey },
        body: formData,
      });

      if (!res.ok) {
        const body = await res.text();
        console.error(`  [DED UPLOAD ERROR] ${res.status}: ${body}`);
        return null;
      }

      const result = await res.json() as Array<{ hash: string; accepted: boolean; eventId: string }>;
      const first = result[0];
      return first?.accepted
        ? { fingerprintHash: first.hash, documentRef }
        : null;
    } catch (err) {
      console.error(`  [DED UPLOAD ERROR] ${err instanceof Error ? err.message : err}`);
      return null;
    }
  }
}
