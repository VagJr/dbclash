import assert from 'node:assert/strict';
import { GameEngine } from '../server/server-engine.js';
import { getCardById } from '../js/card-database.js';

function makeEngine() {
  const e = new GameEngine(() => {}, () => {});
  e.startMatch('goku', 'vegeta', [], false);
  e.clearReactionTimer();
  e.clearBeamClashLoop();
  return e;
}

function snapshot(e) {
  return JSON.stringify({
    state: e.state,
    initiative: e.initiative,
    player: {
      hp: e.player.hp,
      ki: e.player.ki,
      hand: e.player.hand.map(c => c.id),
      discard: [...e.player.discard]
    },
    opponent: {
      hp: e.opponent.hp,
      ki: e.opponent.ki,
      hand: e.opponent.hand.map(c => c.id),
      discard: [...e.opponent.discard]
    },
    pendingAttack: e.pendingAttack?.card?.id || null
  });
}

let passed = 0;
function test(name, fn) {
  try {
    fn();
    console.log('PASS', name);
    passed++;
  } catch (err) {
    console.error('FAIL', name);
    throw err;
  }
}

test('chargeKi fora da iniciativa nÃ£o muta estado', () => {
  const e = makeEngine();
  e.state = 'FREE_ACTION';
  e.initiative = 'opponent';
  e.player.ki = 2;
  const before = snapshot(e);
  assert.equal(e._chargeKi('player'), false);
  assert.equal(snapshot(e), before);
  e.reset();
});

test('carta defensiva em FREE_ACTION nÃ£o Ã© consumida', () => {
  const e = makeEngine();
  e.state = 'FREE_ACTION';
  e.initiative = 'player';
  e.player.ki = 10;
  e.player.hand = [{ ...getCardById('def_01'), instanceId: 'x' }];
  const before = snapshot(e);
  assert.equal(e._playCard('player', 0), false);
  assert.equal(snapshot(e), before);
  e.reset();
});

test('atacante nÃ£o pode reagir ao prÃ³prio ataque', () => {
  const e = makeEngine();
  e.state = 'ATTACK_PENDING';
  e.pendingAttack = { attackerKey: 'player', card: getCardById('atk_02') };
  e.player.ki = 10;
  e.player.hand = [{ ...getCardById('def_01'), instanceId: 'x' }];
  const before = snapshot(e);
  assert.equal(e._playCard('player', 0), false);
  assert.equal(snapshot(e), before);
  e.reset();
});

test('reaÃ§Ã£o invÃ¡lida nÃ£o cancela ataque nem consome carta', () => {
  const e = makeEngine();
  e.state = 'ATTACK_PENDING';
  e.pendingAttack = { attackerKey: 'player', card: getCardById('atk_01') };
  e.opponent.ki = 10;
  e.opponent.hand = [{ ...getCardById('atk_01'), instanceId: 'x' }];
  const before = snapshot(e);
  assert.equal(e._playCard('opponent', 0), false);
  assert.equal(snapshot(e), before);
  e.reset();
});

test('dano letal apÃ³s defesa encerra a partida', () => {
  const e = makeEngine();
  e.state = 'ATTACK_PENDING';
  e.pendingAttack = { attackerKey: 'player', card: { ...getCardById('atk_03'), power: 65 } };
  e.opponent.hp = 10;
  e.opponent.shields = 1;
  e.opponent.ki = 10;
  e.opponent.hand = [{ ...getCardById('def_08'), block: 20, instanceId: 'd' }];
  assert.equal(e._playCard('opponent', 0), true);
  assert.equal(e.opponent.hp, 0);
  assert.equal(e.state, 'GAME_OVER');
  assert.equal(e.winner, 'player');
  e.reset();
});

test('beam clash usa eixo player/opponent consistente em qualquer atacante', () => {
  const e = makeEngine();
  e.state = 'BEAM_CLASH';
  e.pendingAttack = { attackerKey: 'opponent', card: getCardById('atk_02') };
  e.beamClashData = {
    p1Progress: 50,
    timer: 6,
    attackerKey: 'opponent',
    defenderKey: 'player'
  };
  e.lastMashAt = { player: 0, opponent: 0 };

  assert.equal(e._mashBeamClash('opponent'), true);
  assert.equal(e.beamClashData.p1Progress, 43);

  e.lastMashAt.player = 0;
  assert.equal(e._mashBeamClash('player'), true);
  assert.equal(e.beamClashData.p1Progress, 50);
  e.reset();
});

test('sync inclui winner/awaken/openGuard/deckCount e esconde mÃ£o rival', () => {
  const e = makeEngine();
  e.player.hand = [{ ...getCardById('atk_01'), instanceId: 'a' }];
  e.opponent.hand = [
    { ...getCardById('atk_02'), instanceId: 'b' },
    { ...getCardById('def_01'), instanceId: 'c' }
  ];
  e.player.isAwakened = true;
  e.player.isOpenGuard = true;
  e.winner = 'player';

  const p1 = e.getFullSyncState('player');
  const p2 = e.getFullSyncState('opponent');

  assert.equal(p1.winner, 'player');
  assert.equal(p1.player.isAwakened, true);
  assert.equal(p1.player.isOpenGuard, true);
  assert.equal(p1.player.deckCount, e.player.deck.length);
  assert.equal(p1.player.hand[0].id, 'atk_01');
  assert.equal(p1.opponent.hand[0].hidden, true);
  assert.equal(p2.opponent.hand[0].id, 'atk_02');
  assert.equal(p2.player.hand[0].hidden, true);
  e.reset();
});

console.log('\nCORE RELEASE TESTS: ' + passed + ' PASS / 0 FAIL');
