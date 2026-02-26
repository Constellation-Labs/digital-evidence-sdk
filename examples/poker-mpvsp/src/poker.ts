import type {
  Card, Rank, Suit, HandRank, PlayerAction, Agent,
  StateRecord, ActionLogEntry,
} from './types.js';
import { SUITS, RANKS } from './types.js';
import {
  generateDeckSeed, shuffleDeck, commitDeck, commitCard,
} from './crypto.js';
import { ProtocolManager } from './protocol.js';

// ============================================================================
// Deck Operations
// ============================================================================

export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push(`${rank}${suit}` as Card);
    }
  }
  return deck;
}

// ============================================================================
// Hand Evaluation
// ============================================================================

const RANK_VALUES: Record<Rank, number> = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7,
  '8': 8, '9': 9, 'T': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14,
};

function cardRank(card: Card): number { return RANK_VALUES[card[0] as Rank]!; }
function cardSuit(card: Card): Suit { return card[1] as Suit; }

function evaluate5(cards: Card[]): HandRank {
  const ranks = cards.map(cardRank).sort((a, b) => b - a);
  const suits = cards.map(cardSuit);

  const isFlush = suits.every(s => s === suits[0]);
  const uniqueRanks = [...new Set(ranks)].sort((a, b) => b - a);

  // Check straight (including A-2-3-4-5 wheel)
  let isStraight = false;
  let straightHigh = 0;
  if (uniqueRanks.length === 5) {
    if (ranks[0]! - ranks[4]! === 4) {
      isStraight = true;
      straightHigh = ranks[0]!;
    } else if (ranks[0] === 14 && ranks[1] === 5 && ranks[4] === 2) {
      isStraight = true;
      straightHigh = 5; // wheel
    }
  }

  // Frequency counts
  const freq = new Map<number, number>();
  for (const r of ranks) freq.set(r, (freq.get(r) ?? 0) + 1);
  const counts = [...freq.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0]);

  if (isFlush && isStraight) {
    return straightHigh === 14
      ? { rank: 9, name: 'Royal Flush', kickers: [14] }
      : { rank: 8, name: 'Straight Flush', kickers: [straightHigh] };
  }
  if (counts[0]![1] === 4) {
    return { rank: 7, name: 'Four of a Kind', kickers: [counts[0]![0], counts[1]![0]] };
  }
  if (counts[0]![1] === 3 && counts[1]![1] === 2) {
    return { rank: 6, name: 'Full House', kickers: [counts[0]![0], counts[1]![0]] };
  }
  if (isFlush) {
    return { rank: 5, name: 'Flush', kickers: ranks };
  }
  if (isStraight) {
    return { rank: 4, name: 'Straight', kickers: [straightHigh] };
  }
  if (counts[0]![1] === 3) {
    return { rank: 3, name: 'Three of a Kind', kickers: [counts[0]![0], ...ranks.filter(r => r !== counts[0]![0]).slice(0, 2)] };
  }
  if (counts[0]![1] === 2 && counts[1]![1] === 2) {
    const pairs = [counts[0]![0], counts[1]![0]].sort((a, b) => b - a);
    const kicker = ranks.find(r => r !== pairs[0] && r !== pairs[1])!;
    return { rank: 2, name: 'Two Pair', kickers: [...pairs, kicker] };
  }
  if (counts[0]![1] === 2) {
    return { rank: 1, name: 'Pair', kickers: [counts[0]![0], ...ranks.filter(r => r !== counts[0]![0]).slice(0, 3)] };
  }
  return { rank: 0, name: 'High Card', kickers: ranks };
}

/** Find the best 5-card hand from 7 cards */
export function bestHand(cards: Card[]): HandRank {
  let best: HandRank = { rank: -1, name: '', kickers: [] };

  // Generate all C(7,5) = 21 combinations
  for (let i = 0; i < cards.length; i++) {
    for (let j = i + 1; j < cards.length; j++) {
      const five = cards.filter((_, idx) => idx !== i && idx !== j);
      const hand = evaluate5(five);
      if (compareHands(hand, best) > 0) best = hand;
    }
  }
  return best;
}

function compareHands(a: HandRank, b: HandRank): number {
  if (a.rank !== b.rank) return a.rank - b.rank;
  for (let i = 0; i < Math.min(a.kickers.length, b.kickers.length); i++) {
    if (a.kickers[i] !== b.kickers[i]) return a.kickers[i]! - b.kickers[i]!;
  }
  return 0;
}

// ============================================================================
// Agent Decision Making
// ============================================================================

export function agentDecide(
  agent: Agent,
  holeCards: Card[],
  communityCards: Card[],
  pot: number,
  currentBet: number,
  playerBet: number,
  playerChips: number,
): PlayerAction {
  const toCall = currentBet - playerBet;
  const handStrength = estimateStrength(holeCards, communityCards);

  switch (agent.strategy) {
    case 'tight':
      if (handStrength < 0.3 && toCall > 0) return { type: 'fold' };
      if (handStrength > 0.7 && playerChips > currentBet * 2) {
        return { type: 'raise', amount: Math.min(currentBet * 2 || 40, playerChips) };
      }
      return toCall === 0 ? { type: 'check' } : { type: 'call' };

    case 'loose':
      if (handStrength < 0.15 && toCall > pot * 0.5) return { type: 'fold' };
      if (handStrength > 0.6 && playerChips > currentBet * 2) {
        return { type: 'raise', amount: Math.min(currentBet * 3 || 60, playerChips) };
      }
      return toCall === 0 ? { type: 'check' } : { type: 'call' };

    case 'random': {
      const r = Math.random();
      if (toCall === 0) {
        return r < 0.7 ? { type: 'check' } : { type: 'raise', amount: Math.min(40, playerChips) };
      }
      if (r < 0.2) return { type: 'fold' };
      if (r < 0.8) return { type: 'call' };
      return { type: 'raise', amount: Math.min(currentBet * 2, playerChips) };
    }
  }
}

/** Quick hand strength estimate (0-1) based on hole cards + community */
function estimateStrength(holeCards: Card[], communityCards: Card[]): number {
  if (communityCards.length === 0) {
    // Pre-flop: evaluate hole cards only
    const r1 = cardRank(holeCards[0]!);
    const r2 = cardRank(holeCards[1]!);
    const paired = r1 === r2;
    const suited = cardSuit(holeCards[0]!) === cardSuit(holeCards[1]!);
    const highCard = Math.max(r1, r2);
    let strength = (highCard - 2) / 12 * 0.5; // 0-0.5 based on high card
    if (paired) strength += 0.3;
    if (suited) strength += 0.1;
    if (Math.abs(r1 - r2) <= 2) strength += 0.05; // connected
    return Math.min(1, strength);
  }

  // Post-flop: evaluate best 5-card hand
  const all = [...holeCards, ...communityCards];
  if (all.length >= 5) {
    const hand = bestHand(all);
    return Math.min(1, hand.rank / 8 + 0.1);
  }
  return 0.3;
}

// ============================================================================
// Poker Game — orchestrates a full Texas Hold'em game
// ============================================================================

export class PokerGame {
  private readonly protocol: ProtocolManager;
  private readonly agents: Agent[];
  private deck: Card[] = [];
  private deckSeed: string = '';
  private dealPosition: number = 0;
  // Each agent's hole cards (private knowledge, indexed by agent name)
  private holeCards: Map<string, Card[]> = new Map();

  constructor(protocol: ProtocolManager, agents: Agent[]) {
    this.protocol = protocol;
    this.agents = agents;
  }

  // --- Main Game Loop ---

  async playGame(): Promise<void> {
    const rules = this.protocol.getState().program.rules;
    console.log(`\n${'='.repeat(60)}`);
    console.log(`  POKER MPVSP DEMO — ${this.agents.length} players, ${rules.handsToPlay} hands`);
    console.log(`  Instance: ${this.protocol.getInstanceId()}`);
    console.log(`${'='.repeat(60)}`);

    // Genesis checkpoint
    await this.protocol.checkpoint();

    for (let h = 1; h <= rules.handsToPlay; h++) {
      const activePlayers = this.agents.filter(a => {
        const p = this.protocol.getParticipant(a.name);
        return p.chips > 0;
      });

      if (activePlayers.length < 2) {
        console.log(`\n  Game over — not enough players with chips.`);
        break;
      }

      await this.playHand(h);
    }

    // Final state
    this.protocol.applyTransition('game_complete', s => { s.state.phase = 'complete'; });
    await this.protocol.checkpoint();

    console.log(`\n${'='.repeat(60)}`);
    console.log(`  FINAL RESULTS`);
    console.log(`${'='.repeat(60)}`);
    for (const agent of this.agents) {
      const p = this.protocol.getParticipant(agent.name);
      const delta = p.chips - rules.startingChips;
      const sign = delta >= 0 ? '+' : '';
      console.log(`  ${agent.name}: ${p.chips} chips (${sign}${delta})`);
    }
    console.log(`  Final state hash: ${this.protocol.getCurrentHash()}`);
  }

  // --- Single Hand ---

  private async playHand(handNumber: number): Promise<void> {
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`  Hand #${handNumber}`);
    console.log(`${'─'.repeat(60)}`);

    // 1. Setup: new deck, reset player states
    this.setupHand(handNumber);

    // 2. Post blinds
    this.postBlinds();

    // 3. Deal hole cards (with commitments)
    this.dealHoleCards();

    // 4. Pre-flop betting
    this.protocol.printState();
    if (!this.isBettingOver()) {
      this.bettingRound('pre-flop');
    }

    // 5. Flop (3 cards)
    if (this.countActivePlayers() > 1) {
      this.dealCommunityCards(3, 'flop');
      if (!this.isBettingOver()) this.bettingRound('flop');
    }

    // 6. Turn (1 card)
    if (this.countActivePlayers() > 1) {
      this.dealCommunityCards(1, 'turn');
      if (!this.isBettingOver()) this.bettingRound('turn');
    }

    // 7. River (1 card)
    if (this.countActivePlayers() > 1) {
      this.dealCommunityCards(1, 'river');
      if (!this.isBettingOver()) this.bettingRound('river');
    }

    // 8. Showdown
    this.showdown();

    // 9. Checkpoint to DED
    await this.protocol.checkpoint();
  }

  // --- Hand Phases ---

  private setupHand(handNumber: number): void {
    this.deckSeed = generateDeckSeed();
    this.deck = shuffleDeck(createDeck(), this.deckSeed);
    this.dealPosition = 0;
    this.holeCards.clear();
    const deckCommitment = commitDeck(this.deckSeed, this.deck);

    this.protocol.applyTransition('setup_hand', s => {
      s.state.handNumber = handNumber;
      s.state.phase = 'pre-flop';
      s.state.pot = 0;
      s.state.currentBet = 0;
      s.state.communityCards = [];
      s.state.deckCommitment = deckCommitment;
      s.state.deckSeed = null;
      s.state.actionLog = [];
      s.state.lastAction = 'setup';
      s.state.dealerIndex = (handNumber - 1) % s.state.playOrder.length;

      for (const name of s.state.playOrder) {
        const p = s.participants[name]!;
        if (p.chips > 0) {
          p.status = 'active';
          p.currentBet = 0;
          p.holeCardCommitments = [];
        } else {
          p.status = 'out';
        }
      }
    });
  }

  private postBlinds(): void {
    const state = this.protocol.getState().state;
    const order = state.playOrder;
    const n = order.length;
    const sbIdx = (state.dealerIndex + 1) % n;
    const bbIdx = (state.dealerIndex + 2) % n;
    const rules = this.protocol.getState().program.rules;

    this.protocol.applyTransition('post_blinds', s => {
      const sbPlayer = s.participants[order[sbIdx]!]!;
      const bbPlayer = s.participants[order[bbIdx]!]!;
      const sb = Math.min(rules.smallBlind, sbPlayer.chips);
      const bb = Math.min(rules.bigBlind, bbPlayer.chips);

      sbPlayer.chips -= sb;
      sbPlayer.currentBet = sb;
      bbPlayer.chips -= bb;
      bbPlayer.currentBet = bb;
      s.state.pot = sb + bb;
      s.state.currentBet = bb;

      // First to act is after big blind
      s.state.activePlayerIndex = (bbIdx + 1) % n;

      s.state.actionLog.push(
        { player: order[sbIdx]!, action: 'small_blind', amount: sb, epoch: s.metadata.epoch + 1 },
        { player: order[bbIdx]!, action: 'big_blind', amount: bb, epoch: s.metadata.epoch + 1 },
      );
      s.state.lastAction = `blinds: ${order[sbIdx]} ${sb}, ${order[bbIdx]} ${bb}`;
    });

    console.log(`  Blinds posted: ${this.protocol.getState().state.lastAction}`);
  }

  private dealHoleCards(): void {
    const state = this.protocol.getState().state;
    const activePlayers = state.playOrder.filter(
      name => this.protocol.getParticipant(name).status === 'active'
    );

    // Deal 2 cards to each player
    for (const name of activePlayers) {
      const cards: Card[] = [
        this.deck[this.dealPosition]!,
        this.deck[this.dealPosition + 1]!,
      ];
      this.holeCards.set(name, cards);
      this.dealPosition += 2;
    }

    // Record commitments in state (not the actual cards)
    this.protocol.applyTransition('deal_hole_cards', s => {
      for (const name of activePlayers) {
        const cards = this.holeCards.get(name)!;
        s.participants[name]!.holeCardCommitments = cards.map(
          (card, i) => commitCard(this.deckSeed, i, card)
        );
      }
      s.state.lastAction = 'hole_cards_dealt';
    });

    // Show each agent their cards
    for (const name of activePlayers) {
      const cards = this.holeCards.get(name)!;
      console.log(`  ${name} dealt: ${cards.join(' ')} (private)`);
    }
  }

  private dealCommunityCards(count: number, phase: string): void {
    const cards: Card[] = [];
    // Burn one card before dealing community cards
    this.dealPosition++;
    for (let i = 0; i < count; i++) {
      cards.push(this.deck[this.dealPosition]!);
      this.dealPosition++;
    }

    this.protocol.applyTransition(`deal_${phase}`, s => {
      s.state.communityCards.push(...cards);
      s.state.phase = phase as any;
      s.state.currentBet = 0;
      s.state.lastAction = `${phase}: ${cards.join(' ')}`;

      // Reset bets for new round
      for (const name of s.state.playOrder) {
        const p = s.participants[name]!;
        if (p.status === 'active') p.currentBet = 0;
      }
    });

    console.log(`  ${phase.toUpperCase()}: ${cards.join(' ')}`);
  }

  private bettingRound(phase: string): void {
    const order = this.protocol.getState().state.playOrder;
    let startIdx = this.protocol.getState().state.activePlayerIndex;
    let lastRaiser: string | null = null;
    let acted = new Set<string>();
    let idx = startIdx;
    let maxIterations = order.length * 4; // safety limit

    while (maxIterations-- > 0) {
      const name = order[idx % order.length]!;
      const p = this.protocol.getParticipant(name);

      // Skip non-active players
      if (p.status !== 'active') {
        idx++;
        continue;
      }

      // If we've gone around to the last raiser and everyone has acted, done
      if (lastRaiser === name && acted.has(name)) break;
      if (lastRaiser === null && acted.has(name) && acted.size >= this.countActivePlayers()) break;

      const agent = this.agents.find(a => a.name === name)!;
      const holeCards = this.holeCards.get(name) ?? [];
      const state = this.protocol.getState().state;

      const action = agentDecide(
        agent, holeCards, state.communityCards,
        state.pot, state.currentBet, p.currentBet, p.chips,
      );

      this.applyAction(name, action);
      acted.add(name);

      if (action.type === 'raise') lastRaiser = name;
      if (this.countActivePlayers() <= 1) break;

      idx++;
    }
  }

  private applyAction(playerName: string, action: PlayerAction): void {
    this.protocol.applyTransition(`action_${action.type}`, s => {
      const p = s.participants[playerName]!;

      switch (action.type) {
        case 'fold':
          p.status = 'folded';
          break;

        case 'check':
          // No change
          break;

        case 'call': {
          const toCall = Math.min(s.state.currentBet - p.currentBet, p.chips);
          p.chips -= toCall;
          p.currentBet += toCall;
          s.state.pot += toCall;
          if (p.chips === 0) p.status = 'all-in';
          break;
        }

        case 'raise': {
          const raiseTotal = Math.min(action.amount, p.chips);
          const toAdd = raiseTotal - p.currentBet;
          p.chips -= toAdd;
          p.currentBet = raiseTotal;
          s.state.pot += toAdd;
          s.state.currentBet = raiseTotal;
          if (p.chips === 0) p.status = 'all-in';
          break;
        }

        case 'all-in': {
          const allIn = p.chips;
          s.state.pot += allIn;
          p.currentBet += allIn;
          p.chips = 0;
          p.status = 'all-in';
          if (p.currentBet > s.state.currentBet) {
            s.state.currentBet = p.currentBet;
          }
          break;
        }
      }

      const amount = action.type === 'raise' ? action.amount : undefined;
      s.state.actionLog.push({
        player: playerName,
        action: action.type,
        amount,
        epoch: s.metadata.epoch + 1,
      });
      s.state.lastAction = `${playerName} ${action.type}${amount ? ` ${amount}` : ''}`;
    });

    const p = this.protocol.getParticipant(playerName);
    console.log(`  ${playerName} → ${this.protocol.getState().state.lastAction} (chips: ${p.chips})`);
  }

  private showdown(): void {
    console.log(`\n  --- SHOWDOWN ---`);

    // Reveal deck seed
    this.protocol.applyTransition('reveal_deck', s => {
      s.state.deckSeed = this.deckSeed;
      s.state.phase = 'showdown';
    });

    const state = this.protocol.getState().state;
    const remaining = state.playOrder.filter(name => {
      const p = this.protocol.getParticipant(name);
      return p.status === 'active' || p.status === 'all-in';
    });

    if (remaining.length === 1) {
      // Everyone else folded
      const winner = remaining[0]!;
      console.log(`  ${winner} wins ${state.pot} (all others folded)`);
      this.awardPot(winner, state.pot);
      return;
    }

    // Evaluate hands
    const results: Array<{ name: string; hand: HandRank; cards: Card[] }> = [];
    for (const name of remaining) {
      const holeCards = this.holeCards.get(name)!;
      const allCards = [...holeCards, ...state.communityCards];
      const hand = bestHand(allCards);
      results.push({ name, hand, cards: holeCards });
      console.log(`  ${name}: ${holeCards.join(' ')} → ${hand.name}`);
    }

    // Find winner(s)
    results.sort((a, b) => compareHands(b.hand, a.hand));
    const bestRank = results[0]!.hand;
    const winners = results.filter(r => compareHands(r.hand, bestRank) === 0);

    if (winners.length === 1) {
      console.log(`  Winner: ${winners[0]!.name} with ${winners[0]!.hand.name}!`);
      this.awardPot(winners[0]!.name, state.pot);
    } else {
      const share = Math.floor(state.pot / winners.length);
      console.log(`  Split pot: ${winners.map(w => w.name).join(', ')} (${share} each)`);
      for (const w of winners) {
        this.awardPot(w.name, share);
      }
    }
  }

  private awardPot(winnerName: string, amount: number): void {
    this.protocol.applyTransition('award_pot', s => {
      s.participants[winnerName]!.chips += amount;
      s.state.pot = 0;
      s.state.lastAction = `${winnerName} wins ${amount}`;
    });
  }

  // --- Helpers ---

  private countActivePlayers(): number {
    return this.protocol.getActivePlayerNames().length;
  }

  private isBettingOver(): boolean {
    const active = this.protocol.getActivePlayerNames();
    // Betting is over if only 1 or 0 non-all-in active players
    const canAct = active.filter(name => {
      const p = this.protocol.getParticipant(name);
      return p.status === 'active';
    });
    return canAct.length <= 1;
  }
}
