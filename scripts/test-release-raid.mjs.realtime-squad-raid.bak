import assert from 'node:assert/strict';
import fs from 'node:fs';

import { RaidRoomEngine } from '../server/raid-room-engine.js';
import {
  RAID_BOSSES,
  RAID_MIN_PLAYERS,
  RAID_MAX_PLAYERS,
  RAID_QUEUE_FILL_MS,
  RAID_TURN_MS,
  raidPhaseForHp,
  raidBossAttackProfile
} from '../js/raid-rules.js';
import { getStarterDeckForLeader } from '../js/card-database.js';

function players(count = 3) {
  const leaders = ['goku', 'vegeta', 'gohan', 'frieza'];
  return Array.from({ length: count }, (_, i) => ({
    uid: `u${i + 1}`,
    username: `P${i + 1}`,
    leader: leaders[i % leaders.length],
    deck: getStarterDeckForLeader(leaders[i % leaders.length])
  }));
}

function engine(count = 3, bossId = 'cell_max') {
  return new RaidRoomEngine({
    bossId,
    players: players(count),
    onState: () => {},
    onEvent: () => {},
    onComplete: () => {}
  });
}

let passed = 0;
function test(name, fn) {
  try {
    fn();
    console.log('PASS', name);
    passed += 1;
  } catch (err) {
    console.error('FAIL', name);
    throw err;
  }
}

test('raid suporta party final 3-4 e fill de bots apos 15 segundos', () => {
  assert.equal(RAID_MIN_PLAYERS, 3);
  assert.equal(RAID_MAX_PLAYERS, 4);
  assert.equal(RAID_QUEUE_FILL_MS, 15000);
});

test('existem Cell Max Broly e Jiren com rewards', () => {
  assert.deepEqual(Object.keys(RAID_BOSSES).sort(), ['broly', 'cell_max', 'jiren']);
  for (const boss of Object.values(RAID_BOSSES)) {
    assert.ok(boss.maxHp > 0);
    assert.ok(boss.reward.zeni > 0);
    assert.ok(boss.reward.xp > 0);
    assert.ok(boss.reward.trophies > 0);
  }
});

test('raid inicia com mao 5 e estado ativo', () => {
  const e = engine();
  assert.equal(e.state, 'ACTIVE');
  assert.equal(e.players.length, 3);
  assert.equal(e.players.every(p => p.hand.length === 5), true);
  assert.equal(e.currentPlayerUid, 'u1');
});

test('jogador fora do turno nao pode mutar raid', () => {
  const e = engine();
  const hp = e.boss.hp;
  assert.equal(e.chargeKi('u2'), false);
  assert.equal(e.boss.hp, hp);
  assert.equal(e.currentPlayerUid, 'u1');
});

test('ataque reduz HP do chefe e consome carta/Ki', () => {
  const e = engine();
  const p = e.getPlayer('u1');
  const idx = p.hand.findIndex(c => c.type === 'attack' || c.id === 'tch_03');
  assert.ok(idx >= 0);
  const card = p.hand[idx];
  p.ki = 10;
  const hpBefore = e.boss.hp;
  const handBefore = p.hand.length;
  assert.equal(e.playCard('u1', idx, card.id), true);
  assert.ok(e.boss.hp < hpBefore);
  assert.equal(p.hand.length, handBefore - 1);
});

test('Technique instantanea nao causa ataque fantasma no raid', () => {
  const e = engine();
  const p = e.getPlayer('u1');
  p.hand = [{ id: 'tch_02', name: 'Senzu Bean', type: 'tech', cost: 2, power: 0, rarity: 'super-rare' }];
  p.hp = 300;
  p.ki = 10;
  const bossHp = e.boss.hp;
  assert.equal(e.playCard('u1', 0, 'tch_02'), true);
  assert.equal(e.boss.hp, bossHp);
  assert.equal(p.hp, 350);
});

test('defesa preparada reduz o proximo dano do boss', () => {
  const e = engine();
  const p = e.getPlayer('u1');
  p.hand = [{ id: 'def_11', name: 'Ultra Energy Dome', type: 'defense', cost: 5, block: 80, power: 80 }];
  p.ki = 10;
  assert.equal(e.playCard('u1', 0, 'def_11'), true);
  assert.equal(p.guardBlock >= 80, true);
});

test('evade preparada zera um ataque do boss', () => {
  const e = engine();
  const p = e.getPlayer('u1');
  p.dodgeNext = true;
  const hp = p.hp;
  assert.equal(e._applyBossDamage(p, 100), 0);
  assert.equal(p.hp, hp);
  assert.equal(p.dodgeNext, false);
});

test('counter preparado causa dano no chefe', () => {
  const e = engine();
  const p = e.getPlayer('u1');
  p.counterNext = 30;
  const bossHp = e.boss.hp;
  e._applyBossDamage(p, 10);
  assert.equal(e.boss.hp, bossHp - 30);
});

test('fases do boss seguem 75 50 25 por cento', () => {
  assert.equal(raidPhaseForHp(1000, 1000), 1);
  assert.equal(raidPhaseForHp(750, 1000), 2);
  assert.equal(raidPhaseForHp(500, 1000), 3);
  assert.equal(raidPhaseForHp(250, 1000), 4);
});

test('todo terceiro round usa ultimate em todos', () => {
  const boss = RAID_BOSSES.cell_max;
  const profile = raidBossAttackProfile(boss, 2, 3);
  assert.equal(profile.mode, 'all');
  assert.equal(profile.damage, boss.ultimateDamage);
});

test('chefe a 0 HP encerra em VICTORY', () => {
  const e = engine();
  const p = e.getPlayer('u1');
  p.hand = [{ id: 'atk_27', name: 'Super Spirit Bomb', type: 'attack', cost: 0, power: 9999, isBeam: true }];
  p.ki = 10;
  assert.equal(e.playCard('u1', 0, 'atk_27'), true);
  assert.equal(e.state, 'VICTORY');
  assert.equal(e.finished, true);
});

test('todos jogadores derrubados encerra em DEFEAT', () => {
  const e = engine();
  for (const p of e.players) {
    p.hp = 0;
    p.downed = true;
  }
  e._bossTurn();
  assert.equal(e.state, 'DEFEAT');
});

test('projecao privada nao expoe maos dos companheiros', () => {
  const e = engine();
  const state = e.getStateFor('u1');
  assert.equal(Array.isArray(state.you.hand), true);
  assert.equal(state.players.some(p => Object.prototype.hasOwnProperty.call(p, 'hand')), false);
  assert.equal(state.players.every(p => Number.isInteger(p.handSize)), true);
});

test('abandono do jogador atual avanca sem travar', () => {
  const e = engine();
  assert.equal(e.currentPlayerUid, 'u1');
  assert.equal(e.abandonPlayer('u1'), true);
  assert.notEqual(e.currentPlayerUid, 'u1');
  assert.equal(e.getPlayer('u1').abandoned, true);
});

test('timeout de turno executa pass automatico', () => {
  const e = engine();
  const before = e.currentPlayerUid;
  e.turnDeadline = 1;
  assert.equal(e.tick(2), true);
  assert.notEqual(e.currentPlayerUid, before);
  assert.equal(RAID_TURN_MS, 30000);
});

test('servidor permite 1 humano e completa Raid com bots apos 15s', () => {
  const src = fs.readFileSync(new URL('../server.js', import.meta.url), 'utf8');
  assert.ok(src.includes('join_raid_queue'));
  assert.ok(src.includes('raid_match_found'));
  assert.ok(src.includes('raid_match_resumed'));
  assert.ok(src.includes('raid_result'));
  assert.ok(src.includes('RAID_RECONNECT_GRACE_MS'));
  assert.ok(src.includes('finalizeRaidRoom'));

  assert.match(src, /queue\.entries\.length\s*>=\s*1/);
  assert.match(src, /connected\.length\s*<\s*1/);
  assert.match(
    src,
    /createBotProfile\s*\(\s*\{\s*[\s\S]{0,300}?mode\s*:\s*['"]raid['"]/m
  );
  assert.ok(src.includes('new RaidBotController({ engine: room.engine })'));
});

test('bots de raid nao recebem persistencia/recompensa como usuarios Mongo', () => {
  const src = fs.readFileSync(new URL('../server.js', import.meta.url), 'utf8');
  assert.ok(src.includes('if (slot.isBot) continue;') || src.includes('if (isBotUid(uid)) return null;'));
});

test('cliente nao inicia mais uma luta fake contra Frieza para raid', () => {
  const src = fs.readFileSync(new URL('../js/multiplayer-manager.js', import.meta.url), 'utf8');
  assert.equal(src.includes("raidEngine.startRaid(bossId, [leaderKey, 'vegeta', 'gohan'], this.engine)"), false);
  assert.ok(src.includes("socketManager.emit('join_raid_queue'"));
  assert.ok(src.includes("socketManager.emit('raid_action'"));
});

console.log('RAID RELEASE TESTS: ' + passed + ' PASS / 0 FAIL');
