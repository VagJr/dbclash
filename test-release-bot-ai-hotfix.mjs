import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  BOT_FILL_DELAY_MS,
  createBotProfile,
  chooseDuelBotAction,
  chooseRaidBossDecision
} from '../server/bot-ai.js';
import { GameEngine } from '../server/server-engine.js';
import { getStarterDeckForLeader } from '../js/card-database.js';

let passed = 0;
function test(name, fn) {
  try {
    const value = fn();
    if (value && typeof value.then === 'function') {
      return value.then(() => { passed += 1; console.log('PASS', name); });
    }
    passed += 1;
    console.log('PASS', name);
  } catch (err) {
    console.error('FAIL', name);
    throw err;
  }
}

test('fill global de bots e exatamente 15 segundos', () => {
  assert.equal(BOT_FILL_DELAY_MS, 15000);
});

test('perfil de bot possui uid isolado, leader valido e starter deck', () => {
  const bot = createBotProfile({ mode: 'unit', leader: 'goku' });
  assert.ok(bot.uid.startsWith('bot_unit_'));
  assert.equal(bot.isBot, true);
  assert.equal(bot.leader, 'goku');
  assert.deepEqual(bot.deck, getStarterDeckForLeader('goku'));
});

test('bot de duelo escolhe acao legal no proprio turno', () => {
  const engine = new GameEngine(() => {}, () => {});
  engine.startMatch('goku', 'vegeta', getStarterDeckForLeader('goku'), false, {
    playerDeck: engine.secureShuffle(getStarterDeckForLeader('goku')),
    opponentDeck: engine.secureShuffle(getStarterDeckForLeader('vegeta')),
    initiative: 'opponent'
  });
  const decision = chooseDuelBotAction(engine, 'opponent');
  assert.ok(decision);
  assert.ok(['playCard', 'chargeKi', 'passTurn'].includes(decision.action));
});

test('bot nao tenta jogar fora do proprio turno', () => {
  const engine = new GameEngine(() => {}, () => {});
  engine.startMatch('goku', 'vegeta', getStarterDeckForLeader('goku'), false, {
    playerDeck: engine.secureShuffle(getStarterDeckForLeader('goku')),
    opponentDeck: engine.secureShuffle(getStarterDeckForLeader('vegeta')),
    initiative: 'player'
  });
  assert.equal(chooseDuelBotAction(engine, 'opponent'), null);
});

test('boss AI prioriza ameaca em ataque de alvo unico', () => {
  const decision = chooseRaidBossDecision({
    boss: { id: 'broly', baseDamage: 50, ultimateDamage: 140, ultimateAttack: 'ULTIMATE' },
    phase: 1,
    round: 1,
    players: [
      { uid: 'low', hp: 350, maxHp: 400, ki: 3, threat: 20, downed: false, abandoned: false },
      { uid: 'threat', hp: 350, maxHp: 400, ki: 3, threat: 500, downed: false, abandoned: false }
    ]
  });
  assert.equal(decision.targetUids[0], 'threat');
});

test('Raid configurado para esperar 15s antes do fill', () => {
  const src = fs.readFileSync(new URL('../js/raid-rules.js', import.meta.url), 'utf8');
  assert.match(src, /RAID_QUEUE_FILL_MS\s*=\s*15000/);
});

test('Ranked 1v1 possui fallback de bot', () => {
  const src = fs.readFileSync(new URL('../server.js', import.meta.url), 'utf8');
  assert.ok(src.includes('startRankedBotMatchByUid'));
  assert.ok(src.includes('BOT_FILL_DELAY_MS'));
  assert.ok(src.includes('DuelBotController'));
});

test('2v2 e salas privadas possuem fill de bot', () => {
  const src = fs.readFileSync(new URL('../server/product-modes.js', import.meta.url), 'utf8');
  assert.ok(src.includes('scheduleTeamBotFill'));
  assert.ok(src.includes('schedulePrivateBotFill'));
  assert.ok(src.includes('TagTeamBotController'));
});

test('Raid possui bots aliados e controller automatico', () => {
  const src = fs.readFileSync(new URL('../server.js', import.meta.url), 'utf8');
  assert.ok(src.includes('RaidBotController'));
  assert.match(
    src,
    /createBotProfile\s*\(\s*\{\s*[\s\S]{0,300}?mode\s*:\s*['"]raid['"]/m
  );
  assert.ok(src.includes('new RaidBotController({ engine: room.engine })'));
});

test('boss Raid usa decisao inteligente e threat', () => {
  const src = fs.readFileSync(new URL('../server/raid-room-engine.js', import.meta.url), 'utf8');
  assert.ok(src.includes('chooseRaidBossDecision'));
  assert.ok(src.includes('sourcePlayer.threat'));
});

console.log(`BOT AI RELEASE TESTS: ${passed} PASS / 0 FAIL`);
