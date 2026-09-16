import assert from 'node:assert/strict';
import { GameEngine } from '../server/server-engine.js';
import { CARD_DATABASE, LEADERS, getCardById } from '../js/card-database.js';
import { SPECIAL_RULE_IDS, getEffectiveCardCost, getBeamMashPower, getChargeAmount } from '../js/content-rules.js';

function makeEngine() {
  const e = new GameEngine(() => {}, () => {});
  e.startMatch('goku', 'vegeta', [], false);
  e.clearReactionTimer();
  e.clearBeamClashLoop();
  e.state = 'FREE_ACTION';
  e.initiative = 'player';
  return e;
}
function card(id) {
  const c = getCardById(id);
  assert.ok(c, 'Carta ausente: ' + id);
  return { ...c, instanceId: id + '_test' };
}
let passed = 0;
function test(name, fn) {
  try { fn(); console.log('PASS', name); passed++; }
  catch (err) { console.error('FAIL', name); throw err; }
}

test('banco contem exatamente 70 cartas nas cinco categorias', () => {
  assert.equal(CARD_DATABASE.length, 70);
  const counts = CARD_DATABASE.reduce((acc, c) => { acc[c.type] = (acc[c.type] || 0) + 1; return acc; }, {});
  assert.equal(counts.attack, 28);
  assert.equal(counts.defense, 15);
  assert.equal(counts.evade, 9);
  assert.equal(counts.counter, 9);
  assert.equal(counts.tech, 9);
});

test('IDs invalidos nao viram Meteor Combination', () => {
  assert.equal(getCardById('__invalid__'), null);
});

test('todos os IDs especiais declarados existem no banco', () => {
  for (const id of SPECIAL_RULE_IDS) assert.ok(getCardById(id), id);
});

test('Goku reduz Combo em 1 Ki e Ki/Tech em 2 ao despertar', () => {
  const fighter = { leader: LEADERS.goku, isAwakened: false };
  assert.equal(getEffectiveCardCost(fighter, getCardById('atk_01')), 1);
  fighter.isAwakened = true;
  assert.equal(getEffectiveCardCost(fighter, getCardById('atk_02')), 2);
  assert.equal(getEffectiveCardCost(fighter, getCardById('tch_02')), 0);
});

test('Trunks reduz Esquiva em 1 Ki', () => {
  assert.equal(getEffectiveCardCost({ leader: LEADERS.trunks, isAwakened: false }, getCardById('evd_08')), 1);
});

test('Frieza suprime carga inimiga e desperto carrega 3', () => {
  assert.equal(getChargeAmount({ leader: LEADERS.goku, isAwakened: false }, { leader: LEADERS.frieza, isAwakened: false }), 1);
  assert.equal(getChargeAmount({ leader: LEADERS.frieza, isAwakened: true }, { leader: LEADERS.goku, isAwakened: false }), 3);
});

test('Gohan desperto tem mash aumentado em aproximadamente 50%', () => {
  assert.equal(getBeamMashPower({ leader: LEADERS.gohan, isAwakened: true }), 11);
});

test('Piccolo cura 50 HP ao despertar', () => {
  const e = makeEngine();
  e.player.leader = { ...LEADERS.piccolo };
  e.player.hp = 190;
  e.player.shields = 4;
  assert.equal(e.checkAwaken(e.player), true);
  assert.equal(e.player.isAwakened, true);
  assert.equal(e.player.hp, 240);
  e.reset();
});

test('Vegeta recebe +10 com 3 ataques na mao', () => {
  const e = makeEngine();
  e.player.leader = { ...LEADERS.vegeta };
  e.player.ki = 10;
  e.player.hand = [card('atk_20'), card('atk_21'), card('atk_26')];
  assert.equal(e._playCard('player', 0), true);
  assert.equal(e.pendingAttack.card.resolvedPower, 25);
  e.clearReactionTimer(); e.reset();
});

test('todas as 28 cartas de ataque entram em ATTACK_PENDING sem estado invalido', () => {
  for (const original of CARD_DATABASE.filter(c => c.type === 'attack')) {
    const e = makeEngine();
    e.player.ki = 10;
    e.player.hand = [{ ...original, instanceId: 'x' }];
    assert.equal(e._playCard('player', 0), true, original.id);
    assert.equal(e.state, 'ATTACK_PENDING', original.id);
    assert.equal(e.player.hand.length, 0, original.id);
    assert.ok(e.player.ki >= 0 && e.player.ki <= 10, original.id);
    e.clearReactionTimer(); e.reset();
  }
});

test('as 8 tecnicas instantaneas resolvem sem criar ataque fantasma', () => {
  for (const original of CARD_DATABASE.filter(c => c.type === 'tech' && c.id !== 'tch_03')) {
    const e = makeEngine();
    e.player.hp = 300;
    e.player.shields = 6;
    e.player.ki = 10;
    e.player.hand = [{ ...original, instanceId: 'x' }];
    assert.equal(e._playCard('player', 0), true, original.id);
    assert.notEqual(e.state, 'ATTACK_PENDING', original.id);
    assert.equal(e.pendingAttack, null, original.id);
    assert.ok(e.player.hp >= 0 && e.player.hp <= e.player.maxHp, original.id);
    assert.ok(e.player.ki >= 0 && e.player.ki <= 10, original.id);
    e.reset();
  }
});

test('Spirit Bomb Charge e ataque real de 90 com janela maior', () => {
  const e = makeEngine();
  e.player.ki = 10;
  e.player.hand = [card('tch_03')];
  assert.equal(e._playCard('player', 0), true);
  assert.equal(e.state, 'ATTACK_PENDING');
  assert.equal(e.pendingAttack.card.resolvedPower, 90);
  assert.equal(e.reactionMaxSeconds, 4);
  e.clearReactionTimer(); e.reset();
});

test('Saiyan Pride aplica +25 somente ao proximo ataque', () => {
  const e = makeEngine();
  e.player.ki = 10;
  e.player.hand = [card('tch_04')];
  e._playCard('player', 0);
  assert.equal(e.player.nextAttackBonus, 25);
  e.state = 'FREE_ACTION'; e.initiative = 'player'; e.player.ki = 10;
  e.player.hand = [card('atk_20')];
  e._playCard('player', 0);
  assert.equal(e.pendingAttack.card.resolvedPower, 40);
  assert.equal(e.player.nextAttackBonus, 0);
  e.clearReactionTimer(); e.reset();
});

test('Hellzone Grenade rejeita Defesa Azul sem consumir carta', () => {
  const e = makeEngine();
  e.state = 'ATTACK_PENDING';
  e.pendingAttack = { attackerKey: 'player', card: card('atk_12') };
  e.opponent.ki = 10;
  e.opponent.hand = [card('def_01')];
  assert.equal(e._playCard('opponent', 0), false);
  assert.equal(e.opponent.hand.length, 1);
  e.reset();
});

test('Dragon Fist perfura 50% e Special Beam Cannon 100% da defesa', () => {
  let e = makeEngine();
  e.state = 'ATTACK_PENDING'; e.pendingAttack = { attackerKey: 'player', card: { ...card('atk_04'), resolvedPower: 30 } };
  e.opponent.ki = 10; e.opponent.hand = [card('def_01')];
  e._playCard('opponent', 0);
  assert.equal(e.opponent.hp, 382); // block 12, damage 18
  e.reset();

  e = makeEngine();
  e.state = 'ATTACK_PENDING'; e.pendingAttack = { attackerKey: 'player', card: { ...card('atk_05'), resolvedPower: 55 } };
  e.opponent.ki = 10; e.opponent.hand = [card('def_11')];
  e._playCard('opponent', 0);
  assert.equal(e.opponent.hp, 345);
  e.reset();
});

test('Destructo Disc sempre quebra ao menos um segmento de escudo', () => {
  const e = makeEngine();
  e.state = 'ATTACK_PENDING'; e.pendingAttack = { attackerKey: 'player', card: { ...card('atk_15'), resolvedPower: 36 } };
  e.opponent.hp = 400; e.opponent.shields = 8;
  e.resolveUnansweredAttack();
  assert.ok(e.opponent.hp <= 350);
  assert.ok(e.opponent.shields <= 7);
  e.reset();
});

test('Death Ball drena Ki e Scatter Shot queima uma defesa ao acertar', () => {
  let e = makeEngine();
  e.state = 'ATTACK_PENDING'; e.pendingAttack = { attackerKey: 'player', card: { ...card('atk_18'), resolvedPower: 62 } };
  e.opponent.ki = 5; e.resolveUnansweredAttack();
  assert.equal(e.opponent.ki, 5); // drenou 1 e recebeu +1 no inicio da nova iniciativa
  e.reset();

  e = makeEngine();
  e.state = 'ATTACK_PENDING'; e.pendingAttack = { attackerKey: 'player', card: { ...card('atk_22'), resolvedPower: 28 } };
  e.opponent.hand = [card('def_01'), card('evd_08')];
  e.opponent.deck = ['evd_08'];
  e.resolveUnansweredAttack();
  assert.equal(e.opponent.hand.some(c => c.id === 'def_01'), false);
  assert.equal(e.opponent.discard.includes('def_01'), true);
  e.reset();
});

test('todas as 15 defesas resolvem como resposta valida', () => {
  for (const original of CARD_DATABASE.filter(c => c.type === 'defense')) {
    const e = makeEngine();
    e.state = 'ATTACK_PENDING';
    e.pendingAttack = { attackerKey: 'player', card: { ...card('atk_03'), resolvedPower: 65 } };
    e.opponent.ki = 10;
    e.opponent.hand = [{ ...original, instanceId: 'x' }];
    assert.equal(e._playCard('opponent', 0), true, original.id);
    assert.notEqual(e.state, 'ATTACK_PENDING', original.id);
    e.reset();
  }
});

test('Full Power Deflect reflete 10 HP', () => {
  const e = makeEngine();
  e.state = 'ATTACK_PENDING'; e.pendingAttack = { attackerKey: 'player', card: { ...card('atk_03'), resolvedPower: 65 } };
  e.opponent.ki = 10; e.opponent.hand = [card('def_07')];
  e._playCard('opponent', 0);
  assert.equal(e.player.hp, 390);
  e.reset();
});

test('todas as 9 esquivas resolvem; Afterimage exige golpe fisico', () => {
  for (const original of CARD_DATABASE.filter(c => c.type === 'evade')) {
    const e = makeEngine();
    const atk = original.id === 'evd_02' ? card('atk_01') : card('atk_03');
    e.state = 'ATTACK_PENDING'; e.pendingAttack = { attackerKey: 'player', card: { ...atk, resolvedPower: atk.power } };
    e.opponent.ki = 10; e.opponent.hand = [{ ...original, instanceId: 'x' }];
    assert.equal(e._playCard('opponent', 0), true, original.id);
    e.reset();
  }
  const e = makeEngine();
  e.state = 'ATTACK_PENDING'; e.pendingAttack = { attackerKey: 'player', card: { ...card('atk_03'), resolvedPower: 65 } };
  e.opponent.ki = 10; e.opponent.hand = [card('evd_02')];
  assert.equal(e._playCard('opponent', 0), false);
  e.reset();
});

test('todas as 9 counters resolvem e aplicam dano quando descrito', () => {
  for (const original of CARD_DATABASE.filter(c => c.type === 'counter')) {
    const e = makeEngine();
    const atk = original.id === 'ctr_08' ? card('atk_01') : card('atk_03');
    e.state = 'ATTACK_PENDING'; e.pendingAttack = { attackerKey: 'player', card: { ...atk, resolvedPower: atk.power } };
    e.opponent.ki = 10; e.opponent.hand = [{ ...original, instanceId: 'x' }];
    const before = e.player.hp;
    assert.equal(e._playCard('opponent', 0), true, original.id);
    if (original.power > 0) assert.equal(e.player.hp, before - original.power, original.id);
    e.reset();
  }
});

test('Ki Blast Deflection so responde Beam e Emperor Finger Snap so fisico', () => {
  let e = makeEngine();
  e.state = 'ATTACK_PENDING'; e.pendingAttack = { attackerKey: 'player', card: card('atk_01') };
  e.opponent.ki = 10; e.opponent.hand = [card('ctr_04')];
  assert.equal(e._playCard('opponent', 0), false);
  e.reset();

  e = makeEngine();
  e.state = 'ATTACK_PENDING'; e.pendingAttack = { attackerKey: 'player', card: card('atk_03') };
  e.opponent.ki = 10; e.opponent.hand = [card('ctr_08')];
  assert.equal(e._playCard('opponent', 0), false);
  e.reset();
});

test('Piccolo desperto perfura 100% de defesa com ataque de Ki', () => {
  const e = makeEngine();
  e.player.leader = { ...LEADERS.piccolo };
  e.player.isAwakened = true;
  e.state = 'ATTACK_PENDING'; e.pendingAttack = { attackerKey: 'player', card: { ...card('atk_02'), resolvedPower: 40 } };
  e.opponent.ki = 10; e.opponent.hand = [card('def_11')];
  e._playCard('opponent', 0);
  assert.equal(e.opponent.hp, 360);
  e.reset();
});

test('Beam Clash usa o poder real do feixe vencedor', () => {
  const e = makeEngine();
  e.state = 'ATTACK_PENDING';
  e.pendingAttack = { attackerKey: 'player', card: { ...card('atk_02'), resolvedPower: 40 } };
  assert.equal(e.startBeamClashLoop({ ...card('atk_03'), resolvedPower: 65 }), true);
  e.clearBeamClashLoop();
  assert.equal(e.resolveBeamClashWinner('opponent'), true);
  assert.equal(e.player.hp, 335);
  e.reset();
});

console.log('CONTENT RELEASE TESTS: ' + passed + ' PASS / 0 FAIL');
