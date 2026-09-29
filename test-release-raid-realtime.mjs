import assert from 'node:assert/strict';
import fs from 'node:fs';
import { RaidRoomEngine } from '../server/raid-room-engine.js';
import {
  RAID_BOSSES,
  RAID_MIN_PLAYERS,
  RAID_MAX_PLAYERS,
  RAID_QUEUE_FILL_MS,
  RAID_PLAYER_ACTION_COOLDOWN_MS,
  RAID_BOSS_ACTION_MS,
  raidPhaseForHp,
  raidBossAttackProfile
} from '../js/raid-rules.js';
import { getStarterDeckForLeader, getCardById } from '../js/card-database.js';

function players(count = 4) {
  const leaders = ['goku', 'vegeta', 'gohan', 'frieza'];
  return Array.from({ length: count }, (_, i) => ({ uid: `u${i + 1}`, username: `P${i + 1}`, leader: leaders[i % leaders.length], deck: getStarterDeckForLeader(leaders[i % leaders.length]) }));
}
function engine(count = 4, bossId = 'cell_max') {
  return new RaidRoomEngine({ bossId, players: players(count), onState: () => {}, onEvent: () => {}, onComplete: () => {} });
}
let passed = 0;
function test(name, fn) { try { fn(); passed++; console.log('PASS', name); } catch (err) { console.error('FAIL', name); throw err; } }

test('Raid aceita um humano e fill de bots em 15s ate quatro', () => {
  assert.equal(RAID_MIN_PLAYERS, 1);
  assert.equal(RAID_MAX_PLAYERS, 4);
  assert.equal(RAID_QUEUE_FILL_MS, 15000);
});

test('runtime Raid e simultaneo com cooldown independente e boss clock', () => {
  assert.equal(RAID_PLAYER_ACTION_COOLDOWN_MS > 0, true);
  assert.equal(RAID_BOSS_ACTION_MS > RAID_PLAYER_ACTION_COOLDOWN_MS, true);
  const e = engine();
  assert.equal(e.state, 'ACTIVE');
  assert.equal(e.players.length, 4);
  assert.equal(typeof e.bossActionAt, 'number');
  assert.equal('currentPlayerUid' in e, false);
});

test('dois jogadores distintos podem agir sem revezamento de turno', () => {
  const e = engine();
  e.getPlayer('u1').actionReadyAt = 0;
  e.getPlayer('u2').actionReadyAt = 0;
  const k1 = e.getPlayer('u1').ki;
  const k2 = e.getPlayer('u2').ki;
  assert.equal(e.chargeKi('u1'), true);
  assert.equal(e.chargeKi('u2'), true);
  assert.ok(e.getPlayer('u1').ki > k1);
  assert.ok(e.getPlayer('u2').ki > k2);
});

test('ataque de jogador reduz HP do chefe', () => {
  const e = engine();
  const p = e.getPlayer('u1');
  p.actionReadyAt = 0;
  p.ki = 10;
  p.hand = [{ ...getCardById('atk_01'), instanceId: 'atk' }];
  const before = e.boss.hp;
  assert.equal(e.playCard('u1', 0, 'atk_01'), true);
  assert.ok(e.boss.hp < before);
});

test('defesa preparada protege proximo ataque do chefe', () => {
  const e = engine();
  const p = e.getPlayer('u1');
  p.guardBlock = 80;
  const before = p.hp;
  const dealt = e._applyBossDamage(p, 100, { isBeam: true });
  assert.equal(dealt, 20);
  assert.equal(p.hp, before - 20);
});

test('boss age pelo proprio relogio no tick', () => {
  const e = engine();
  const beforeRound = e.round;
  e.bossActionAt = 1;
  assert.equal(e.tick(2), true);
  assert.equal(e.round, beforeRound + 1);
});

test('boss AI conserva ultimate a cada terceiro ciclo', () => {
  const boss = RAID_BOSSES.cell_max;
  const profile = raidBossAttackProfile(boss, 2, 3);
  assert.equal(profile.mode, 'all');
  assert.equal(profile.damage, boss.ultimateDamage);
});

test('fases do boss seguem 75 50 25 por cento', () => {
  assert.equal(raidPhaseForHp(1000, 1000), 1);
  assert.equal(raidPhaseForHp(750, 1000), 2);
  assert.equal(raidPhaseForHp(500, 1000), 3);
  assert.equal(raidPhaseForHp(250, 1000), 4);
});

test('projecao privada expoe apenas a propria mao', () => {
  const e = engine();
  const state = e.getStateFor('u1');
  assert.ok(Array.isArray(state.you.hand));
  assert.equal(state.players.some(p => Object.prototype.hasOwnProperty.call(p, 'hand')), false);
  assert.equal(state.mode, 'raid-realtime');
});

test('server protege emitRaidState contra engine nulo e tick contra sala quebrada', () => {
  const src = fs.readFileSync(new URL('../server.js', import.meta.url), 'utf8');
  assert.match(src, /if \(!room\?\.engine\) return;/);
  assert.match(src, /!room\.finalized && room\.engine/);
});

test('server cria Raid bot controller realtime', () => {
  const src = fs.readFileSync(new URL('../server.js', import.meta.url), 'utf8');
  assert.ok(src.includes('RaidRealtimeBotController'));
  assert.match(src, /createBotProfile\s*\([\s\S]{0,200}?mode\s*:\s*['"]raid['"]/m);
});

test('cliente Raid mostra quatro aliados simultaneos e sem currentPlayerUid', () => {
  const src = fs.readFileSync(new URL('../js/raid-engine.js', import.meta.url), 'utf8');
  assert.ok(src.includes('TODOS AGEM AO MESMO TEMPO'));
  assert.equal(src.includes('state.currentPlayerUid'), false);
});

console.log(`RAID RELEASE TESTS: ${passed} PASS / 0 FAIL`);
