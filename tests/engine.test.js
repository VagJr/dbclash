import assert from 'node:assert';
import crypto from 'node:crypto';

// ═══════════════════════════════════════════════════════════════════
// POLYFILLS: Browser globals required by the game engines
// ═══════════════════════════════════════════════════════════════════
global.window = { crypto: { getRandomValues: (buf) => crypto.randomFillSync(buf) } };
global.document = {
  getElementById: () => null,
  createElement: () => ({ classList: { add(){}, remove(){} }, style: {}, appendChild(){}, innerHTML: '' }),
};
global.soundEngine = { playCardPlay(){}, playCardClash(){}, playZVanish(){}, playClick(){}, playAwaken(){} };
global.uiManager = null;
global.authManager = null;

import { GameEngine } from '../js/game-engine.js';
import { Mode2v2Engine } from '../js/mode-2v2.js';
import { ModeRaidEngine } from '../js/mode-raid.js';
import { getStarterDeckForLeader, getCardById } from '../js/card-database.js';

// ═══════════════════════════════════════════════════════════════════
// TEST RUNNER
// ═══════════════════════════════════════════════════════════════════
let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log(`✅ ${name}`); passed++; }
  catch (e) { console.error(`❌ ${name}`); console.error(`   ${e.message}`); failed++; }
}

function makeEngine(initiative = 'player') {
  const e = new GameEngine();
  e.startMatch('goku', 'vegeta', [], false);
  e.initiative = initiative;
  return e;
}

function findCard(leader, type) {
  return getStarterDeckForLeader(leader).map(getCardById).find(c => c && c.type === type);
}

console.log('🧪 DBTCG — Bateria Completa de Testes Automatizados\n');

// ═══════════════════════════════════════════════════════════════════
// 1v1 GAME ENGINE TESTS
// ═══════════════════════════════════════════════════════════════════
console.log('━━━ 1v1 GameEngine ━━━');

test('ChargeKi: Ki sobe +2 exatamente uma vez', () => {
  const e = makeEngine('player');
  e.chargeKi('player');
  assert.strictEqual(e.player.ki, 5);
});

test('ChargeKi SPAM: 5 cliques rápidos = apenas 1 cobrado', () => {
  const e = makeEngine('player');
  for (let i = 0; i < 5; i++) e.chargeKi('player');
  assert.strictEqual(e.player.ki, 5, `Ki esperado 5, obteve ${e.player.ki}`);
  assert.strictEqual(e.initiative, 'opponent');
});

test('ChargeKi: não funciona fora do turno', () => {
  const e = makeEngine('opponent');
  e.chargeKi('player');
  assert.strictEqual(e.player.ki, 3, 'Ki não deve mudar fora do turno');
});

test('PassTurn: iniciativa muda e oponente ganha +1 Ki', () => {
  const e = makeEngine('player');
  const oppKiBefore = e.opponent.ki;
  e.passTurn('player');
  assert.strictEqual(e.initiative, 'opponent');
  assert.strictEqual(e.opponent.ki, oppKiBefore + 1);
});

test('PlayCard BEAM_CLASH: carta rejeitada, mão intacta', () => {
  const e = makeEngine('player');
  e.state = 'BEAM_CLASH';
  e.beamClashData = { p1Progress: 50, timer: 6.0 };
  e.player.ki = 10;
  const handBefore = e.player.hand.length;
  e.playCard('player', 0);
  assert.strictEqual(e.state, 'BEAM_CLASH');
  assert.strictEqual(e.player.hand.length, handBefore);
  assert.strictEqual(e.player.ki, 10);
});

test('PlayCard GAME_OVER: carta rejeitada', () => {
  const e = makeEngine('player');
  e.state = 'GAME_OVER';
  e.player.ki = 10;
  const handBefore = e.player.hand.length;
  e.playCard('player', 0);
  assert.strictEqual(e.player.hand.length, handBefore);
});

test('PlayCard defesa em FREE_ACTION: rejeitada', () => {
  const e = makeEngine('player');
  e.player.ki = 10;
  const defCard = findCard('vegeta', 'defense');
  e.player.hand.push(defCard);
  const handBefore = e.player.hand.length;
  e.playCard('player', handBefore - 1);
  assert.strictEqual(e.player.hand.length, handBefore, 'Carta de defesa não deve ser consumida em FREE_ACTION');
});

test('PlayCard ataque: transição FREE_ACTION → ATTACK_PENDING', () => {
  const e = makeEngine('player');
  e.player.ki = 10;
  const atkCard = findCard('goku', 'attack');
  e.player.hand.push(atkCard);
  const handBefore = e.player.hand.length;
  e.playCard('player', handBefore - 1);
  assert.strictEqual(e.state, 'ATTACK_PENDING');
  assert.strictEqual(e.player.hand.length, handBefore - 1);
  assert.ok(e.pendingAttack, 'pendingAttack deve existir');
  assert.strictEqual(e.pendingAttack.attackerKey, 'player');
});

test('PlayCard reação defesa: resolve ATTACK_PENDING → FREE_ACTION', () => {
  const e = makeEngine('player');
  const atkCard = findCard('goku', 'attack');
  e.pendingAttack = { attackerKey: 'player', card: atkCard };
  e.state = 'ATTACK_PENDING';
  e.opponent.ki = 10;
  const defCard = findCard('vegeta', 'defense');
  e.opponent.hand.push(defCard);
  const oppHandBefore = e.opponent.hand.length;
  e.playCard('opponent', oppHandBefore - 1);
  assert.strictEqual(e.state, 'FREE_ACTION', 'Estado deve voltar para FREE_ACTION');
  assert.strictEqual(e.pendingAttack, null, 'pendingAttack deve ser limpo');
  assert.strictEqual(e._isResolvingAttack, false, '_isResolvingAttack deve ser false');
});

test('Reação DUPLA: segunda reação é ignorada', () => {
  const e = makeEngine('player');
  const atkCard = findCard('goku', 'attack');
  e.pendingAttack = { attackerKey: 'player', card: atkCard };
  e.state = 'ATTACK_PENDING';
  e.opponent.ki = 10;
  const defCard = findCard('vegeta', 'defense');
  e.opponent.hand.push({ ...defCard, instanceId: 'a' });
  e.opponent.hand.push({ ...defCard, instanceId: 'b' });
  const handBefore = e.opponent.hand.length;
  e.playCard('opponent', handBefore - 1);
  e.playCard('opponent', handBefore - 2);
  assert.strictEqual(e.opponent.hand.length, handBefore, 'Apenas 1 carta deve ser consumida (1 jogada, 1 comprada)');
});

test('Ki insuficiente: carta rejeitada', () => {
  const e = makeEngine('player');
  e.player.ki = 0;
  const atkCard = findCard('goku', 'attack');
  if (atkCard && atkCard.cost > 0) {
    e.player.hand.push(atkCard);
    const handBefore = e.player.hand.length;
    e.playCard('player', handBefore - 1);
    assert.strictEqual(e.player.hand.length, handBefore, 'Carta não deve ser consumida com Ki insuficiente');
    assert.strictEqual(e.player.ki, 0);
  }
});

test('Atacante não pode jogar durante ATTACK_PENDING', () => {
  const e = makeEngine('player');
  const atkCard = findCard('goku', 'attack');
  e.pendingAttack = { attackerKey: 'player', card: atkCard };
  e.state = 'ATTACK_PENDING';
  e.player.ki = 10;
  const atkCard2 = findCard('goku', 'attack');
  e.player.hand.push(atkCard2);
  const handBefore = e.player.hand.length;
  e.playCard('player', handBefore - 1);
  assert.strictEqual(e.player.hand.length, handBefore);
});

test('resolveUnansweredAttack: aplica dano e transiciona', () => {
  const e = makeEngine('player');
  const atkCard = findCard('goku', 'attack');
  e.pendingAttack = { attackerKey: 'player', card: atkCard };
  e.state = 'ATTACK_PENDING';
  e.attackResolved = false;
  e._isResolvingAttack = false;
  const oppHpBefore = e.opponent.hp;
  e.resolveUnansweredAttack();
  assert.ok(e.opponent.hp < oppHpBefore, 'Oponente deve ter perdido HP');
  assert.strictEqual(e.pendingAttack, null);
  assert.strictEqual(e._isResolvingAttack, false);
  assert.strictEqual(e.isActionProcessing, false);
});

test('resolveUnansweredAttack DUPLA: segunda chamada ignorada', () => {
  const e = makeEngine('player');
  const atkCard = findCard('goku', 'attack');
  e.pendingAttack = { attackerKey: 'player', card: atkCard };
  e.state = 'ATTACK_PENDING';
  e.attackResolved = false;
  e._isResolvingAttack = false;
  e.resolveUnansweredAttack();
  const hpAfterFirst = e.opponent.hp;
  // Tenta resolver de novo
  e.state = 'ATTACK_PENDING'; // force state back
  e.resolveUnansweredAttack();
  assert.strictEqual(e.opponent.hp, hpAfterFirst, 'HP não deve mudar na segunda chamada');
});

test('Beam Clash: resolveBeamClashWinner aplica dano e limpa estado', () => {
  const e = makeEngine('player');
  e.state = 'BEAM_CLASH';
  e.beamClashData = { p1Progress: 100, timer: 1.0 };
  e._beamClashOriginalAttacker = 'player';
  const oppHpBefore = e.opponent.hp;
  e.resolveBeamClashWinner('player');
  assert.ok(e.opponent.hp < oppHpBefore, 'Perdedor deve perder HP');
  assert.strictEqual(e.state, 'FREE_ACTION');
  assert.strictEqual(e.beamClashData, null);
  assert.strictEqual(e.pendingAttack, null);
  assert.strictEqual(e._isResolvingAttack, false);
  assert.strictEqual(e.isActionProcessing, false);
});

test('log() não dispara render recursivo', () => {
  const e = makeEngine('player');
  let renderCount = 0;
  e.render = () => { renderCount++; };
  e.log('teste', 'info');
  assert.strictEqual(renderCount, 0, 'log() não deve chamar render');
  e.notifyState();
  assert.strictEqual(renderCount, 1, 'notifyState deve chamar render uma vez');
});

test('HP persiste após chargeKi + passTurn ciclo', () => {
  const e = makeEngine('player');
  const hpBefore = e.player.hp;
  e.chargeKi('player'); // passa turno para opponent
  e.initiative = 'opponent';
  e.chargeKi('opponent'); // passa turno para player
  assert.strictEqual(e.player.hp, hpBefore, 'HP não deve mudar com chargeKi');
});

test('Ki persiste: chargeKi acumula corretamente', () => {
  const e = makeEngine('player');
  assert.strictEqual(e.player.ki, 3);
  e.chargeKi('player');
  assert.strictEqual(e.player.ki, 5);
  // Agora é turno do opponent
  assert.strictEqual(e.initiative, 'opponent');
  // Opponent passa, player ganha +1
  e.passTurn('opponent');
  assert.strictEqual(e.player.ki, 6); // 5 + 1 do passTurn
});

// ═══════════════════════════════════════════════════════════════════
// 2v2 MODE TESTS
// ═══════════════════════════════════════════════════════════════════
console.log('\n━━━ 2v2 Mode2v2Engine ━━━');

test('2v2 ChargeKi SPAM: apenas 1 cobrado', () => {
  const e = new Mode2v2Engine();
  e.startMatch('goku', getStarterDeckForLeader('goku'));
  const p1 = e.fighters['p1'];
  const kiBefore = p1.ki;
  e.chargeKi('p1');
  e.chargeKi('p1');
  e.chargeKi('p1');
  assert.strictEqual(p1.ki, kiBefore + 2);
  assert.notStrictEqual(e.activeFighterId, 'p1');
});

test('2v2 playCard durante BEAM_CLASH: rejeitada', () => {
  const e = new Mode2v2Engine();
  e.startMatch('goku', getStarterDeckForLeader('goku'));
  e.state = 'BEAM_CLASH';
  const p1 = e.fighters['p1'];
  const handBefore = p1.hand.length;
  e.playCard('p1', 0, 'opp1');
  assert.strictEqual(p1.hand.length, handBefore);
});

// ═══════════════════════════════════════════════════════════════════
// RAID MODE TESTS
// ═══════════════════════════════════════════════════════════════════
console.log('\n━━━ Raid ModeRaidEngine ━━━');

test('Raid ChargeKi SPAM: apenas 1 cobrado', () => {
  const e = new ModeRaidEngine();
  e.startRaid('cell_max', 'goku', getStarterDeckForLeader('goku'), [
    { id: 'p1', username: 'P1' },
    { id: 'p2', username: 'P2' },
    { id: 'p3', username: 'P3' },
    { id: 'p4', username: 'P4' }
  ]);
  const p1 = e.players['p1'];
  const kiBefore = p1.ki;
  e.chargeKi('p1');
  e.chargeKi('p1');
  assert.strictEqual(p1.ki, kiBefore + 2);
  assert.notStrictEqual(e.activeFighterId, 'p1');
});

test('Raid playCard fora do turno: rejeitada', () => {
  const e = new ModeRaidEngine();
  e.startRaid('cell_max', 'goku', getStarterDeckForLeader('goku'), [
    { id: 'p1', username: 'P1' },
    { id: 'p2', username: 'P2' },
    { id: 'p3', username: 'P3' },
    { id: 'p4', username: 'P4' }
  ]);
  // Force activeFighter to p2
  e.activeFighterId = 'p2';
  const p1 = e.players['p1'];
  const handBefore = p1.hand.length;
  e.playCard('p1', 0);
  assert.strictEqual(p1.hand.length, handBefore);
});

// ═══════════════════════════════════════════════════════════════════
// RESULTS
// ═══════════════════════════════════════════════════════════════════
console.log(`\n${'═'.repeat(50)}`);
console.log(`🎯 Resultados: ${passed} passaram, ${failed} falharam`);
console.log(`${'═'.repeat(50)}`);
if (failed > 0) process.exit(1);
