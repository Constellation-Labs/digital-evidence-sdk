# Poker MPVSP Demo

Texas Hold'em poker played by AI agents, with every state transition
cryptographically committed to the
[Digital Evidence Depository (DED)](https://github.com/constellation-network/ded).

This demonstrates the **Multi-Party Verifiable State Protocol (MPVSP)**
pattern: multiple parties maintain a shared state record, co-sign transitions,
and checkpoint committed state hashes to DED for tamper-evident auditability.

## How It Works

### State Record (Not MPT)

Instead of a Merkle Patricia Trie, the game state is a single JSON object:

```
{
  program:      { rules, version, codeRef (git repo) }
  participants: { [player]: { chips, status, holeCardCommitments } }
  state:        { phase, pot, communityCards, deckCommitment, ... }
  metadata:     { epoch, previousStateHash, timestamp }
}
```

The **state hash** is `SHA-256(RFC8785(stateRecord))` — a single commitment
to the entire game state. This hash becomes the `documentRef` in DED
fingerprints.

### Transition Flow

1. **Transition applied** (bet, deal, fold, etc.)
2. **State record updated** with new values
3. **Epoch incremented**, `previousStateHash` set to prior hash
4. **All agents co-sign** the new state hash
5. **Periodically checkpointed** to DED as a fingerprint

### Card Commitment Scheme

- Dealer generates a random 32-byte seed per hand
- Deck shuffled deterministically: `SHA-256(seed + "shuffle" + index)`
- Deck commitment: `SHA-256(seed + ":" + JSON(deck))`
- Card commitments: `SHA-256(seed + ":" + position + ":" + card)`
- At showdown, the seed is revealed and all cards can be verified

### DED Integration

Each checkpoint submits:
- **Fingerprint**: `documentRef` = state hash, `documentId` = `poker:{id}:epoch:{N}`
- **Document upload**: Full state diff via `POST /v1/fingerprints/upload`
- **Co-signatures**: All active players sign the fingerprint

## Setup

```bash
# Install dependencies
npm install

# Copy and configure
cp config.example.json config.json
# Edit config.json with your DED credentials (org, tenant, apiKey)
```

## Running

```bash
# Dry run (no DED API calls, just local game)
npm run start:dry

# Live (submits to DED)
npm start
```

### Configuration

| Field | Description |
|-------|-------------|
| `ded.baseUrl` | DED API URL |
| `ded.orgId` | Your organization UUID |
| `ded.tenantId` | Your tenant UUID |
| `ded.apiKey` | Your API key |
| `game.startingChips` | Chips per player |
| `game.smallBlind` | Small blind amount |
| `game.bigBlind` | Big blind amount |
| `game.handsToPlay` | Number of hands |
| `players` | Array of `{ name, strategy }` |
| `codeRef` | Git reference to transition code |
| `dryRun` | Skip DED API calls |
| `keysDir` | Directory for persistent keypairs |
| `checkpointEveryNHands` | DED checkpoint frequency |

### Agent Strategies

- **tight**: Folds weak hands, raises strong ones
- **loose**: Plays most hands, aggressive raises
- **random**: Unpredictable decisions

## Keypairs

On first run, SECP256K1 keypairs are generated for each player and saved to
`keys/`. On subsequent runs, the same keys are reused. This means the same
agent identity persists across games.

## Verification

Any party holding the state record can verify:

1. **State integrity**: `SHA-256(RFC8785(stateRecord)) == documentRef`
2. **Chain integrity**: Each epoch's `previousStateHash` matches the prior hash
3. **Deck fairness**: Revealed `deckSeed` reproduces the committed deck
4. **Card authenticity**: Each card's commitment matches `SHA-256(seed:pos:card)`
5. **Signature validity**: All co-signatures verify against registered public keys

## Architecture

```
┌──────────┐  ┌──────────┐  ┌──────────┐
│  Alice   │  │   Bob    │  │ Charlie  │
│  (tight) │  │  (loose) │  │ (random) │
└────┬─────┘  └────┬─────┘  └────┬─────┘
     │             │              │
     └──────┬──────┴──────┬───────┘
            │             │
     ┌──────▼──────┐ ┌────▼────────┐
     │  Protocol   │ │   Poker     │
     │  Manager    │ │   Game      │
     │(state hash) │ │ (rules)     │
     └──────┬──────┘ └─────────────┘
            │
     ┌──────▼──────┐
     │   DED API   │
     │ (checkpoint) │
     └──────┬──────┘
            │
     ┌──────▼──────┐
     │ Constellation│
     │  Hypergraph  │
     └─────────────┘
```
