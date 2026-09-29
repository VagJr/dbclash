import assert from 'node:assert/strict';
import fs from 'node:fs';
import { BOT_FILL_DELAY_MS, createBotProfile, chooseDuelBotAction, chooseRaidBossDecision } from '../server/bot-ai.js';
import { GameEngine } from '../server/server-engine.js';
import { SquadBattleEngine } from '../server/squad-battle-engine.js';
import { RaidRoomEngine } from '../server/raid-room-engine.js';
import { chooseSquadBotAction, chooseRealtimeRaidBotAction } from '../server/realtime-bot-controllers.js';
import { getStarterDeckForLeader } from '../js/card-database.js';

let passed = 0;
function test(name, fn) { try { fn(); passed++; console.log('PASS', name); } catch (err) { console.error('FAIL', name); throw err; } }

test('fill global de bots e 15 segundos', () => assert.equal(BOT_FILL_DELAY_MS, 15000));

test('perfil de bot tem uid isolado e deck valido', () => {
  const bot = createBotProfile({ mode: 'unit', leader: 'goku' });
  assert.ok(bot.uid.startsWith('bot_unit_'));
  assert.deepEqual(bot.deck, getStarterDeckForLeader('goku'));
});

test('bot 1v1 antigo continua funcional', () => {
  const e = new GameEngine(() => {}, () => {});
  e.startMatch('goku', 'vegeta', getStarterDeckForLeader('goku'), false, { playerDeck: e.secureShuffle(getStarterDeckForLeader('goku')), opponentDeck: e.secureShuffle(getStarterDeckForLeader('vegeta')), initiative: 'opponent' });
  assert.ok(chooseDuelBotAction(e, 'opponent'));
});

test('bot 2v2 realtime escolhe alvo inimigo', () => {
  const bot = createBotProfile({ mode: '2v2', leader: 'goku' });
  const e = new SquadBattleEngine({
    teamA: [bot, { ...createBotProfile({ mode: '2v2', leader: 'vegeta' }), uid: 'a2', isBot: false }],
    teamB: [{ ...createBotProfile({ mode: '2v2', leader: 'gohan' }), uid: 'b1', isBot: false }, { ...createBotProfile({ mode: '2v2', leader: 'frieza' }), uid: 'b2', isBot: false }]
  });
  e.getMember(bot.uid).member.actionReadyAt = 0;
  const d = chooseSquadBotAction(e, bot.uid);
  assert.ok(d);
  if (d.action === 'playCard' && d.targetUid) assert.ok(['b1', 'b2'].includes(d.targetUid));
});

test('bot Raid realtime age sem currentPlayerUid', () => {
  const bot = createBotProfile({ mode: 'raid', leader: 'goku' });
  const e = new RaidRoomEngine({ bossId: 'cell_max', players: [bot] });
  e.getPlayer(bot.uid).actionReadyAt = 0;
  const d = chooseRealtimeRaidBotAction(e, bot.uid);
  assert.ok(d);
});

test('boss AI prioriza threat', () => {
  const d = chooseRaidBossDecision({ boss: { id: 'broly', baseDamage: 50, ultimateDamage: 140 }, phase: 1, round: 1, players: [
    { uid: 'low', hp: 350, maxHp: 400, ki: 3, threat: 20, downed: false, abandoned: false },
    { uid: 'threat', hp: 350, maxHp: 400, ki: 3, threat: 500, downed: false, abandoned: false }
  ] });
  assert.equal(d.targetUids[0], 'threat');
});

test('Ranked 1v1 mantem fallback CPU', () => {
  const src = fs.readFileSync(new URL('../server.js', import.meta.url), 'utf8');
  assert.ok(src.includes('startRankedBotMatchByUid'));
});

test('2v2 e private 2v2 usam fill CPU realtime', () => {
  const src = fs.readFileSync(new URL('../server/product-modes.js', import.meta.url), 'utf8');
  assert.ok(src.includes('scheduleTeamBotFill'));
  assert.ok(src.includes('SquadBotController'));
});

test('Raid usa fill CPU e controller realtime', () => {
  const src = fs.readFileSync(new URL('../server.js', import.meta.url), 'utf8');
  assert.ok(src.includes('RaidRealtimeBotController'));
  assert.match(src, /mode\s*:\s*['"]raid['"]/);
});

console.log(`BOT AI RELEASE TESTS: ${passed} PASS / 0 FAIL`);
