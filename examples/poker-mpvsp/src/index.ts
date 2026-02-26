import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Config, Agent } from './types.js';
import { loadOrGenerateAgent, hashStateRecord, verifyDeckCommitment } from './crypto.js';
import { ProtocolManager } from './protocol.js';
import { PokerGame } from './poker.js';

// ============================================================================
// Entry Point
// ============================================================================

async function main() {
  console.log(`
  ╔══════════════════════════════════════════════╗
  ║  POKER MPVSP — Multi-Party Verifiable State  ║
  ║  Texas Hold'em on Digital Evidence (DED)      ║
  ╚══════════════════════════════════════════════╝
  `);

  // Load config
  const configPath = resolve(process.cwd(), 'config.json');
  if (!existsSync(configPath)) {
    console.error('  config.json not found. Copy config.example.json → config.json and fill in your DED credentials.');
    console.error('  Or run with DRY_RUN=true to test without DED: npm run start:dry');
    process.exit(1);
  }

  const configRaw = await readFile(configPath, 'utf-8');
  const config: Config = JSON.parse(configRaw);

  // Override dryRun from environment
  if (process.env.DRY_RUN === 'true') {
    config.dryRun = true;
  }

  console.log(`  Mode: ${config.dryRun ? 'DRY RUN (no DED calls)' : 'LIVE (submitting to DED)'}`);
  console.log(`  DED: ${config.ded.baseUrl}`);
  console.log(`  Players: ${config.players.map(p => `${p.name} (${p.strategy})`).join(', ')}`);
  console.log(`  Rules: ${config.game.startingChips} chips, blinds ${config.game.smallBlind}/${config.game.bigBlind}`);

  // Load or generate agent keypairs
  const agents: Agent[] = [];
  for (const playerConfig of config.players) {
    const agent = await loadOrGenerateAgent(
      playerConfig.name,
      playerConfig.strategy,
      config.keysDir,
    );
    agents.push(agent);
    console.log(`  ${agent.name}: key=${agent.publicKey.slice(0, 16)}... (${agent.strategy})`);
  }

  // Create protocol and game
  const protocol = new ProtocolManager(agents, config);
  const game = new PokerGame(protocol, agents);

  // Print initial state hash
  const genesisHash = protocol.getCurrentHash();
  console.log(`\n  Genesis state hash: ${genesisHash.slice(0, 32)}...`);
  console.log(`  Code reference: ${config.codeRef.repository}@${config.codeRef.branch}`);

  // Play the game
  await game.playGame();

  // Final verification: any party can recompute the state hash
  const finalState = protocol.getState();
  const verifiedHash = hashStateRecord(finalState);
  const isValid = ProtocolManager.verifyStateHash(finalState, verifiedHash);
  console.log(`\n  State integrity: ${isValid ? 'VERIFIED' : 'FAILED'}`);
  console.log(`  Total epochs: ${protocol.getEpoch()}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
