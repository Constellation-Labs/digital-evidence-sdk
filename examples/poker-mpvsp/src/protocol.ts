import { randomUUID } from 'node:crypto';
import type {
  StateRecord, ProgramSpec, GameState, ParticipantState,
  StateMetadata, Config, Agent, Card, ActionLogEntry,
} from './types.js';
import { hashStateRecord, canonicalJson } from './crypto.js';
import { DedClient } from './ded.js';

// ============================================================================
// Protocol Manager — manages the canonical state record and DED checkpoints
// ============================================================================

export class ProtocolManager {
  private stateRecord: StateRecord;
  private readonly instanceId: string;
  private readonly agents: Agent[];
  private readonly dedClient: DedClient;
  private readonly config: Config;
  private transitionLog: Array<{ epoch: number; transition: string; stateHash: string }> = [];

  constructor(agents: Agent[], config: Config) {
    this.agents = agents;
    this.config = config;
    this.instanceId = randomUUID();
    this.dedClient = new DedClient(config);

    // Build genesis state
    const participants: Record<string, ParticipantState> = {};
    const playOrder: string[] = [];

    for (const agent of agents) {
      participants[agent.name] = {
        publicKey: agent.publicKey,
        chips: config.game.startingChips,
        status: 'waiting',
        currentBet: 0,
        holeCardCommitments: [],
      };
      playOrder.push(agent.name);
    }

    this.stateRecord = {
      program: {
        name: 'texas-holdem-mpvsp',
        version: 1,
        codeRef: config.codeRef,
        rules: config.game,
      },
      participants,
      state: {
        phase: 'setup',
        handNumber: 0,
        dealerIndex: 0,
        pot: 0,
        currentBet: 0,
        activePlayerIndex: 0,
        communityCards: [],
        deckCommitment: '',
        deckSeed: null,
        lastAction: 'genesis',
        playOrder,
        actionLog: [],
      },
      metadata: {
        instanceId: this.instanceId,
        epoch: 0,
        previousStateHash: '0'.repeat(64),
        timestamp: new Date().toISOString(),
      },
    };
  }

  // --- State Access ---

  getState(): Readonly<StateRecord> { return this.stateRecord; }
  getInstanceId(): string { return this.instanceId; }
  getEpoch(): number { return this.stateRecord.metadata.epoch; }
  getCurrentHash(): string { return hashStateRecord(this.stateRecord); }

  getParticipant(name: string): ParticipantState {
    const p = this.stateRecord.participants[name];
    if (!p) throw new Error(`Unknown participant: ${name}`);
    return p;
  }

  getActivePlayerNames(): string[] {
    return this.stateRecord.state.playOrder.filter(
      name => {
        const p = this.stateRecord.participants[name]!;
        return p.status === 'active' || p.status === 'all-in';
      }
    );
  }

  getNonFoldedPlayerNames(): string[] {
    return this.stateRecord.state.playOrder.filter(
      name => {
        const p = this.stateRecord.participants[name]!;
        return p.status !== 'folded' && p.status !== 'out' && p.status !== 'waiting';
      }
    );
  }

  // --- State Mutation via Transitions ---

  /**
   * Apply a named transition to the state record.
   * Increments epoch, updates previousStateHash, and logs the transition.
   */
  applyTransition(transitionName: string, mutate: (state: StateRecord) => void): string {
    const previousHash = this.getCurrentHash();

    // Apply mutation
    mutate(this.stateRecord);

    // Update metadata
    this.stateRecord.metadata.epoch += 1;
    this.stateRecord.metadata.previousStateHash = previousHash;
    this.stateRecord.metadata.timestamp = new Date().toISOString();

    const newHash = this.getCurrentHash();

    this.transitionLog.push({
      epoch: this.stateRecord.metadata.epoch,
      transition: transitionName,
      stateHash: newHash,
    });

    return newHash;
  }

  // --- DED Checkpointing ---

  async checkpoint(): Promise<void> {
    const activeAgents = this.agents.filter(a => {
      const p = this.stateRecord.participants[a.name];
      return p && p.status !== 'out';
    });

    // Submit fingerprint with state hash
    const result = await this.dedClient.checkpoint(
      this.stateRecord,
      this.instanceId,
      this.stateRecord.metadata.epoch,
      activeAgents,
    );

    if (result) {
      console.log(`  [CHECKPOINT] Epoch ${this.stateRecord.metadata.epoch} → ${result.documentRef.slice(0, 16)}...`);
    }

    // Upload state diff (the full transition log since last checkpoint)
    if (this.transitionLog.length > 0) {
      const diffPayload = canonicalJson({
        instanceId: this.instanceId,
        fromEpoch: this.transitionLog[0]!.epoch,
        toEpoch: this.stateRecord.metadata.epoch,
        transitions: this.transitionLog,
        fullState: this.stateRecord,
      });

      await this.dedClient.uploadStateDiff(
        this.stateRecord,
        this.instanceId,
        this.stateRecord.metadata.epoch,
        activeAgents,
        diffPayload,
      );

      this.transitionLog = [];
    }
  }

  // --- Verification ---

  /**
   * Verify that a state record hash matches a known commitment.
   * Any party can run this to validate the current state.
   */
  static verifyStateHash(record: StateRecord, expectedHash: string): boolean {
    return hashStateRecord(record) === expectedHash;
  }

  /**
   * Pretty-print the current state for debugging.
   */
  printState(): void {
    const s = this.stateRecord;
    console.log(`\n  State [epoch=${s.metadata.epoch}, hand=#${s.state.handNumber}, phase=${s.state.phase}]`);
    console.log(`  Pot: ${s.state.pot} | Bet: ${s.state.currentBet}`);
    if (s.state.communityCards.length > 0) {
      console.log(`  Community: ${s.state.communityCards.join(' ')}`);
    }
    for (const [name, p] of Object.entries(s.participants)) {
      if (p.status !== 'out') {
        console.log(`    ${name}: ${p.chips} chips [${p.status}] bet=${p.currentBet}`);
      }
    }
  }
}
