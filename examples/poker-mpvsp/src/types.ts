// ============================================================================
// Core State Record — the single object whose hash is committed to DED
// ============================================================================

export interface StateRecord {
  program: ProgramSpec;
  participants: Record<string, ParticipantState>;
  state: GameState;
  metadata: StateMetadata;
}

export interface ProgramSpec {
  name: string;
  version: number;
  codeRef: CodeRef;
  rules: PokerRules;
}

export interface CodeRef {
  repository: string;
  branch: string;
  entrypoint: string;
}

export interface PokerRules {
  startingChips: number;
  smallBlind: number;
  bigBlind: number;
  handsToPlay: number;
}

export interface ParticipantState {
  publicKey: string;
  chips: number;
  status: 'waiting' | 'active' | 'folded' | 'all-in' | 'out';
  currentBet: number;
  holeCardCommitments: string[];  // SHA-256 commitments (visible to all)
}

export interface GameState {
  phase: 'setup' | 'pre-flop' | 'flop' | 'turn' | 'river' | 'showdown' | 'complete';
  handNumber: number;
  dealerIndex: number;
  pot: number;
  currentBet: number;
  activePlayerIndex: number;
  communityCards: Card[];
  deckCommitment: string;
  deckSeed: string | null;       // null until reveal (showdown)
  lastAction: string;
  playOrder: string[];           // player IDs in seat order
  actionLog: ActionLogEntry[];   // actions this hand
}

export interface ActionLogEntry {
  player: string;
  action: string;
  amount?: number;
  epoch: number;
}

export interface StateMetadata {
  instanceId: string;
  epoch: number;
  previousStateHash: string;
  timestamp: string;
}

// ============================================================================
// Card Types
// ============================================================================

export const SUITS = ['h', 'd', 'c', 's'] as const;
export const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'] as const;
export type Suit = typeof SUITS[number];
export type Rank = typeof RANKS[number];
export type Card = `${Rank}${Suit}`;

export interface HandRank {
  rank: number;       // 0=high card, 1=pair, ..., 9=royal flush
  name: string;
  kickers: number[];  // for tiebreaking
}

// ============================================================================
// Player Actions
// ============================================================================

export type PlayerAction =
  | { type: 'fold' }
  | { type: 'check' }
  | { type: 'call' }
  | { type: 'raise'; amount: number }
  | { type: 'all-in' };

// ============================================================================
// DED Types
// ============================================================================

export interface FingerprintValue {
  orgId: string;
  tenantId: string;
  eventId: string;
  signerId?: string;
  documentId: string;
  documentRef: string;
  timestamp: string;
  version: number;
}

export interface SignatureProof {
  id: string;          // public key hex (128 chars, no 04 prefix)
  signature: string;   // DER-encoded ECDSA signature hex
  algorithm: string;
}

export interface SignedFingerprint {
  content: FingerprintValue;
  proofs: SignatureProof[];
}

export interface FingerprintSubmission {
  attestation: SignedFingerprint;
  metadata?: { hash: string; tags?: Record<string, string> };
}

// ============================================================================
// Agent Interface
// ============================================================================

export interface Agent {
  name: string;
  publicKey: string;
  privateKey: Uint8Array;
  strategy: 'tight' | 'loose' | 'random';
}

// ============================================================================
// Config
// ============================================================================

export interface Config {
  ded: { baseUrl: string; orgId: string; tenantId: string; apiKey: string };
  game: PokerRules;
  players: { name: string; strategy: 'tight' | 'loose' | 'random' }[];
  codeRef: CodeRef;
  dryRun: boolean;
  keysDir: string;
  checkpointEveryNHands: number;
}
