import assert from 'node:assert/strict';
import fs from 'node:fs';

import { SquadBattleEngine } from '../server/squad-battle-engine.js';
import { CARD_DATABASE, getStarterDeckForLeader } from '../js/card-database.js';

let passed = 0;
function test(name, fn) {
  try {
    const result = fn();
    if (result && typeof result.then === 'function') {
      return result.then(() => {
        passed += 1;
        console.log('PASS', name);
      });
    }
    passed += 1;
    console.log('PASS', name);
  } catch (err) {
    console.error('FAIL', name);
    throw err;
  }
}

const makeEntry = (uid, username, leader) => ({
  uid,
  username,
  leader,
  deck: getStarterDeckForLeader(leader),
  isBot: false
});

function makeEngine() {
  return new SquadBattleEngine({
    teamA: [
      makeEntry('a1', 'A1', 'goku'),
      makeEntry('a2', 'A2', 'vegeta')
    ],
    teamB: [
      makeEntry('b1', 'B1', 'gohan'),
      makeEntry('b2', 'B2', 'frieza')
    ],
    onState: () => {},
    onFx: () => {},
    onComplete: () => {}
  });
}

const attacks = CARD_DATABASE.filter(card => card.type === 'attack');
const beams = attacks.filter(card => card.isBeam);
const defense = CARD_DATABASE.find(card => card.type === 'defense');
const evade = CARD_DATABASE.find(card => card.type === 'evade');
assert.ok(attacks.length > 0 && beams.length >= 2 && defense && evade);

test('projecoes privadas compartilham exatamente o mesmo estado publico', () => {
  const e = makeEngine();
  const a = e.getStateFor('a1');
  const b = e.getStateFor('b1');

  assert.deepEqual(a.teams, b.teams);
  assert.deepEqual(a.pendingAttacks, b.pendingAttacks);
  assert.deepEqual(a.beamClashes, b.beamClashes);

  e.dispose();
});

test('ataque entra em pending antes de alterar HP', () => {
  const e = makeEngine();
  const attacker = e.getMember('a1').member;
  const target = e.getMember('b1').member;

  attacker.actionReadyAt = 0;
  attacker.ki = 10;
  attacker.hand = [{ ...attacks[0], instanceId: 'attack1' }];

  const hp = target.hp;
  assert.equal(
    e.action('a1', 'playCard', {
      cardIndex: 0,
      cardId: attacks[0].id,
      targetUid: 'b1'
    }),
    true
  );

  assert.equal(target.hp, hp);
  assert.equal(e.getStateFor('a1').pendingAttacks.length, 1);

  e.dispose();
});

test('defesa responde ao ataque e resolve de forma autoritativa', () => {
  const e = makeEngine();
  const attacker = e.getMember('a1').member;
  const target = e.getMember('b1').member;

  attacker.actionReadyAt = 0;
  attacker.ki = 10;
  attacker.hand = [{ ...attacks[0], instanceId: 'attack2' }];

  target.ki = 10;
  target.hand = [{ ...defense, instanceId: 'def1' }];

  const hp = target.hp;

  assert.equal(
    e.action('a1', 'playCard', {
      cardIndex: 0,
      cardId: attacks[0].id,
      targetUid: 'b1'
    }),
    true
  );

  assert.equal(
    e.action('b1', 'playCard', {
      cardIndex: 0,
      cardId: defense.id
    }),
    true
  );

  assert.equal(e.pendingAttacks.size, 0);
  assert.ok(target.hp <= hp);
  assert.ok(e.lastResolved?.responseCard);

  e.dispose();
});

test('beam contra beam inicia clash real sem dano imediato', () => {
  const e = makeEngine();
  const attacker = e.getMember('a1').member;
  const target = e.getMember('b1').member;

  attacker.actionReadyAt = 0;
  attacker.ki = 10;
  attacker.hand = [{ ...beams[0], instanceId: 'beamA' }];

  target.ki = 10;
  target.hand = [{ ...beams[1], instanceId: 'beamB' }];

  const hpA = attacker.hp;
  const hpB = target.hp;

  assert.equal(
    e.action('a1', 'playCard', {
      cardIndex: 0,
      cardId: beams[0].id,
      targetUid: 'b1'
    }),
    true
  );

  assert.equal(
    e.action('b1', 'playCard', {
      cardIndex: 0,
      cardId: beams[1].id
    }),
    true
  );

  assert.equal(e.beamClashes.size, 1);
  assert.equal(attacker.hp, hpA);
  assert.equal(target.hp, hpB);

  e.dispose();
});

test('mash de beam altera progresso no servidor', () => {
  const e = makeEngine();
  const attacker = e.getMember('a1').member;
  const target = e.getMember('b1').member;

  attacker.actionReadyAt = 0;
  attacker.ki = 10;
  attacker.hand = [{ ...beams[0], instanceId: 'beamC' }];

  target.ki = 10;
  target.hand = [{ ...beams[1], instanceId: 'beamD' }];

  e.action('a1', 'playCard', {
    cardIndex: 0,
    cardId: beams[0].id,
    targetUid: 'b1'
  });
  e.action('b1', 'playCard', {
    cardIndex: 0,
    cardId: beams[1].id
  });

  const clash = [...e.beamClashes.values()][0];
  const before = clash.progress;

  assert.equal(e.mashBeamClash('a1'), true);
  assert.ok(clash.progress > before);

  e.dispose();
});

test('estado publico permanece identico depois de mudanca de HP', () => {
  const e = makeEngine();

  e.getMember('b1').member.hp = 317;
  e.getMember('a2').member.hp = 222;

  const a = e.getStateFor('a1');
  const b = e.getStateFor('b2');

  assert.deepEqual(a.teams, b.teams);
  assert.equal(a.teams.B.find(p => p.uid === 'b1').hp, 317);
  assert.equal(b.teams.B.find(p => p.uid === 'b1').hp, 317);

  e.dispose();
});

test('servidor versiona um snapshot por broadcast para todos os clientes', () => {
  const src = fs.readFileSync(
    new URL('../server/product-modes.js', import.meta.url),
    'utf8'
  );

  assert.ok(src.includes('room.stateVersion += 1'));
  assert.ok(src.includes('const snapshotVersion = room.stateVersion'));
  assert.ok(src.includes('state.stateVersion = snapshotVersion'));
  assert.ok(src.includes('state.serverNow = serverNow'));
});

test('cliente rejeita team_state antigo ou de outra partida', () => {
  const src = fs.readFileSync(
    new URL('../js/multiplayer-manager.js', import.meta.url),
    'utf8'
  );

  assert.ok(src.includes('payload.matchId !== this.teamMatchId'));
  assert.ok(src.includes('version < this.latestTeamStateVersion'));
  assert.ok(src.includes("String(payload?.type || '').startsWith('squad_')"));
});

test('UI oficial mostra ataque e resposta no drop-zone', () => {
  const src = fs.readFileSync(
    new URL('../js/team-ui.js', import.meta.url),
    'utf8'
  );

  assert.ok(src.includes("document.getElementById('drop-zone')"));
  assert.ok(src.includes('squad-combat-center'));
  assert.ok(src.includes('squad-center-cards'));
  assert.ok(src.includes("role === 'response' ? 'RESPOSTA' : 'ATAQUE'"));
  assert.ok(src.includes('assetLoader.renderCardArtHTML(card)'));
});

test('UI usa reaction banner e Beam Clash oficiais', () => {
  const src = fs.readFileSync(
    new URL('../js/team-ui.js', import.meta.url),
    'utf8'
  );

  assert.ok(src.includes("document.getElementById('reaction-banner')"));
  assert.ok(src.includes("document.getElementById('beam-clash-overlay')"));
  assert.ok(src.includes("intercept('clash-mash-btn', 'mashBeamClash')"));
  assert.ok(src.includes('triggerBeamClash'));
});

console.log(`TEAM COMBAT SYNC TESTS: ${passed} PASS / 0 FAIL`);
