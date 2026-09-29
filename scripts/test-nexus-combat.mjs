import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { GameEngine as ServerDuel } from '../server/server-engine.js';
import { GameEngine as ClientDuel } from '../js/game-engine.js';
import { SquadBattleEngine } from '../server/squad-battle-engine.js';
import { RaidRoomEngine } from '../server/raid-room-engine.js';
import { CARD_DATABASE, getCardById } from '../js/card-database.js';
import { getCardRule, isAttackAction, isImmediateTechnique } from '../js/content-rules.js';
import { chooseNpcDuelAction, normalizeNpcOptions, NPC_DIFFICULTIES, NPC_IDENTITIES, scoreNpcAttack, scoreNpcTechnique, selectNpcOption, npcThinkDelay } from '../js/npc-ai.js';

let passed = 0;
async function test(name, fn) { await fn(); passed++; console.log('PASS', name); }
const cardCopy = card => ({ ...card, instanceId: `test_${card.id}` });
const deck = Array(20).fill('atk_01');
function duel(Engine = ServerDuel) {
  const e = new Engine();
  e.isAiMatch = false;
  e.state = 'FREE_ACTION';
  e.initiative = 'player';
  for (const fighter of [e.player, e.opponent]) {
    fighter.hp = fighter.maxHp = 5000;
    fighter.shields = 100;
    fighter.ki = 10;
    fighter.deck = [...deck];
    fighter.discard = [];
    fighter.hand = [];
  }
  return e;
}
function squad() {
  const entry = uid => ({ uid, leader: 'goku', deck: [...deck] });
  const e = new SquadBattleEngine({ teamA: [entry('a1'), entry('a2')], teamB: [entry('b1'), entry('b2')] });
  for (const fighter of [...e.teams.A, ...e.teams.B]) {
    fighter.hp = fighter.maxHp = 5000;
    fighter.ki = 10;
    fighter.actionReadyAt = 0;
    fighter.hand = [];
  }
  return e;
}
function raid() {
  const e = new RaidRoomEngine({ players: [{ uid: 'a1', leader: 'goku', deck: [...deck] }] });
  const fighter = e.getPlayer('a1');
  fighter.hp = fighter.maxHp = 5000;
  fighter.ki = 10;
  fighter.actionReadyAt = 0;
  fighter.hand = [];
  e.boss.hp = e.boss.maxHp = 5000;
  return e;
}
function incomingFor(card) {
  const rule = getCardRule(card);
  return { ...getCardById(rule.beamOnly || card.isBeam ? 'atk_02' : 'atk_01'), power: 80, resolvedPower: 80, isBeam: !!rule.beamOnly || !!card.isBeam, isCombo: !rule.beamOnly, damageKind: rule.beamOnly ? 'beam' : 'physical' };
}
function snapshot(e) {
  const fighter = f => ({ hp: f.hp, ki: f.ki, isAwakened: f.isAwakened, nextAttackBonus: f.nextAttackBonus, hand: f.hand.map(c => c.id), discard: f.discard, deck: f.deck });
  return { state: e.state, initiative: e.initiative, winner: e.winner, player: fighter(e.player), opponent: fighter(e.opponent) };
}

await test('714 cartas são executáveis e cliente/servidor resolvem o mesmo resultado', () => {
  assert.equal(CARD_DATABASE.length, 714);
  for (const card of CARD_DATABASE) {
    const results = [];
    for (const Engine of [ClientDuel, ServerDuel]) {
      const e = duel(Engine);
      e.player.hand = [cardCopy(card)];
      e.opponent.hand = [cardCopy(getCardById('def_01'))];
      if (!isAttackAction(card) && !isImmediateTechnique(card)) {
        e.state = 'ATTACK_PENDING';
        e.initiative = 'opponent';
        e.pendingAttack = { attackerKey: 'opponent', card: incomingFor(card) };
      }
      assert.equal(e._playCard('player', 0), true, `${Engine.name} não executa ${card.id}`);
      if (e.state === 'ATTACK_PENDING') e.resolveUnansweredAttack();
      if (e.state === 'BEAM_CLASH') e.resolveBeamClashWinner('player');
      assert.ok(['FREE_ACTION', 'GAME_OVER'].includes(e.state), `${card.id}: estado travado`);
      assert.ok(e.player.ki >= 0 && e.player.ki <= 10, card.id);
      results.push(snapshot(e));
      e.reset();
    }
    assert.deepEqual(results[0], results[1], `${card.id}: cliente e servidor divergiram`);
  }
});

await test('toda a coleção é aceita em 2v2 com resposta e dano autoritativo', () => {
  for (const card of CARD_DATABASE) {
    const e = squad();
    const player = e.getMember('a1').member;
    player.hand = [cardCopy(card)];
    if (!isAttackAction(card) && !isImmediateTechnique(card)) e._createPendingAttack(e.getMember('b1').member, player, incomingFor(card), 80);
    assert.equal(e.playCard('a1', 0, card.id, 'b1'), true, card.id);
    const pending = e.getPendingFor('b1');
    if (pending) e._resolvePendingAttack('b1', pending.id);
    for (const clash of e.beamClashes.values()) e._finalizeBeamClash(clash.id);
    assert.ok(player.ki >= 0 && player.ki <= 10, card.id);
    e.dispose();
  }
});

await test('toda a coleção funciona no raid e respeita classificação da reação', () => {
  for (const card of CARD_DATABASE) {
    const e = raid();
    const player = e.getPlayer('a1');
    player.hand = [cardCopy(card)];
    assert.equal(e.playCard('a1', 0, card.id), true, card.id);
    if (!isAttackAction(card) && !isImmediateTechnique(card)) {
      const attack = incomingFor(card);
      e._applyBossDamage(player, 80, { isBeam: attack.isBeam, isPhysical: attack.isCombo });
    }
    assert.ok(player.hp >= 0 && player.ki >= 0 && player.ki <= 10, card.id);
  }
});

for (const Engine of [ClientDuel, ServerDuel]) {
  await test(`${Engine === ClientDuel ? 'cliente' : 'servidor'}: despertar não ressuscita Piccolo após KO`, () => {
    const e = duel(Engine);
    e.opponent.leader = { ...e.opponent.leader, id: 'piccolo' };
    e.opponent.hp = 30;
    e._applyDirectDamage('opponent', 100, 'player');
    assert.equal(e.opponent.hp, 0);
    assert.equal(e.opponent.isAwakened, false);
    assert.equal(e.checkGameOver(), true);
    e.reset();
  });
  await test(`${Engine === ClientDuel ? 'cliente' : 'servidor'}: reação expirada e carta remota inexistente não são consumidas`, () => {
    const e = duel(Engine);
    e.player.hand = [cardCopy(getCardById('def_01'))];
    e.state = 'ATTACK_PENDING';
    e.pendingAttack = { attackerKey: 'opponent', card: incomingFor(getCardById('def_01')) };
    e.reactionDeadline = Date.now() - 1;
    const before = snapshot(e);
    assert.equal(e._playCard('player', 0), false);
    assert.deepEqual(snapshot(e), before);
    e.reactionDeadline = Date.now() + 1000;
    assert.equal(e._playCard('player', 0, 'does_not_exist'), false);
    assert.deepEqual(snapshot(e), before);
    e.reset();
  });
  await test(`${Engine === ClientDuel ? 'cliente' : 'servidor'}: reset cancela ações agendadas do NPC`, () => {
    const e = duel(Engine);
    e.isAiMatch = true;
    e._scheduleAi();
    assert.equal(e.aiTimers.size, 1);
    const epoch = e.matchEpoch;
    e.reset();
    assert.equal(e.aiTimers.size, 0);
    assert.equal(e.matchEpoch, epoch + 1);
  });
  await test(`${Engine === ClientDuel ? 'cliente' : 'servidor'}: CPU finalizar beam dentro do loop não causa crash`, async () => {
    const e = duel(Engine);
    e.isAiMatch = true;
    e.pendingAttack = { attackerKey: 'player', card: cardCopy(getCardById('atk_02')) };
    e.startBeamClashLoop(cardCopy(getCardById('atk_02')));
    e.beamClashData.p1Progress = 1;
    await delay(140);
    assert.equal(e.beamClashData, null);
    assert.equal(e.state, 'FREE_ACTION');
    e.reset();
  });
}

await test('2v2 rejeita segunda batalha do mesmo atacante e resposta fora da janela', () => {
  const e = squad();
  const player = e.getMember('a1').member;
  player.hand = [cardCopy(getCardById('atk_01')), cardCopy(getCardById('atk_02'))];
  assert.equal(e.playCard('a1', 0, 'atk_01', 'b1'), true);
  player.actionReadyAt = 0;
  assert.equal(e.playCard('a1', 0, 'atk_02', 'b2'), false);
  const target = e.getMember('b1').member;
  target.hand = [cardCopy(getCardById('def_01'))];
  e.getPendingFor('b1').deadline = Date.now() - 1;
  const ki = target.ki;
  assert.equal(e.playCard('b1', 0, 'def_01'), false);
  assert.equal(target.ki, ki);
  e.dispose();
});

await test('2v2 drain/burn/ruptura, bônus e kiGainVsBeam têm resultado executável', () => {
  const e = squad();
  const attacker = e.getMember('a1').member;
  const target = e.getMember('b1').member;
  const drain = CARD_DATABASE.find(card => isAttackAction(card) && getCardRule(card).drainKi);
  attacker.hand = [cardCopy(drain)];
  assert.equal(e.playCard('a1', 0, drain.id, 'b1'), true);
  e._resolvePendingAttack('b1', e.getPendingFor('b1').id);
  assert.equal(target.ki, 10 - getCardRule(drain).drainKi);
  attacker.actionReadyAt = 0;
  const burn = CARD_DATABASE.find(card => isAttackAction(card) && getCardRule(card).burnDefense);
  attacker.ki = 10;
  attacker.hand = [cardCopy(burn)];
  target.hand = [cardCopy(getCardById('def_01'))];
  e.playCard('a1', 0, burn.id, 'b1');
  e._resolvePendingAttack('b1', e.getPendingFor('b1').id);
  assert.equal(target.hand.filter(card => card.type === 'defense').length, 0);
  target.ki = 1;
  target.hand = [cardCopy(getCardById('def_06'))];
  const pending = e._createPendingAttack(attacker, target, incomingFor(getCardById('atk_02')), 5);
  e._resolvePendingAttack('b1', pending.id, { card: getCardById('def_06') });
  assert.equal(target.ki, 2);
  e.dispose();
});

await test('raid anuncia alvos antes do ataque e permite uma única resposta durante cooldown', () => {
  const e = raid();
  e.bossActionAt = Date.now() + 1500;
  e.tick(Date.now());
  assert.deepEqual(e.bossIntent.targetUids, ['a1']);
  const player = e.getPlayer('a1');
  player.actionReadyAt = Date.now() + 10000;
  player.hand = [cardCopy(getCardById('def_01')), cardCopy(getCardById('def_01'))];
  assert.equal(e.playCard('a1', 0, 'def_01'), true);
  assert.equal(e.playCard('a1', 0, 'def_01'), false);
  assert.equal(e.getStateFor('a1').bossIntent.respondedUids.length, 1);
});

await test('raid counter cancela dano e responde somente ao tipo permitido', () => {
  const e = raid();
  const player = e.getPlayer('a1');
  player.counterNext = 20;
  player.counterRule = { beamOnly: true };
  const hp = player.hp;
  assert.equal(e._applyBossDamage(player, 100, { isBeam: true }), 0);
  assert.equal(player.hp, hp);
  player.counterNext = 20;
  player.counterRule = { physicalOnly: true };
  assert.equal(e._applyBossDamage(player, 100, { isBeam: true, isPhysical: false }), 100);
});

await test('raid Ki Beam consome carta, aceita mash limitado e resolve sem aplicar o golpe duas vezes', () => {
  const e = raid();
  const player = e.getPlayer('a1');
  player.hand = [cardCopy(getCardById('atk_02'))];
  e.bossActionAt = Date.now() + 1900;
  e.tick(Date.now());
  const hp = player.hp;
  const bossHp = e.boss.hp;
  assert.equal(e.playCard('a1', 0, 'atk_02'), true);
  assert.ok(e.getStateFor('a1').you.beamClash);
  assert.equal(e.mashBeamClash('a1'), true);
  assert.equal(e.mashBeamClash('a1'), false);
  e.beamClashes.get('a1').progress = 100;
  e._resolveRaidClash('a1');
  assert.ok(e.boss.hp < bossHp);
  e._bossTurn(Date.now());
  assert.equal(player.hp, hp);
  assert.equal(e.beamClashes.size, 0);
});

await test('NPC possui 4 dificuldades e 6 identidades reais e persiste no reset', () => {
  assert.deepEqual(Object.keys(NPC_DIFFICULTIES), ['easy', 'normal', 'hard', 'expert']);
  assert.equal(Object.keys(NPC_IDENTITIES).length, 6);
  assert.equal(npcThinkDelay({ difficulty: 'easy' }, () => 0), 1100);
  assert.equal(npcThinkDelay({ difficulty: 'expert' }, () => 0), 220);
  assert.deepEqual(normalizeNpcOptions({ difficulty: 'invalid' }), { difficulty: 'normal', identity: 'goku' });
  const e = duel();
  e.configureNpc({ difficulty: 'expert', identity: 'frieza' });
  e.reset();
  assert.deepEqual(e.npcOptions, { difficulty: 'expert', identity: 'frieza' });
});

await test('NPC expert encontra letal e defesa contra dano fatal sem consultar a mão adversária', () => {
  const e = duel();
  e.configureNpc({ difficulty: 'expert', identity: 'vegeta' });
  e.initiative = 'opponent';
  e.player.hp = 30;
  e.opponent.hand = [cardCopy(getCardById('tch_02')), { ...getCardById('atk_01'), power: 50 }];
  assert.equal(chooseNpcDuelAction(e, 'opponent', () => 0).cardId, 'atk_01');
  e.state = 'ATTACK_PENDING';
  e.pendingAttack = { attackerKey: 'player', card: { ...getCardById('atk_01'), power: 400 } };
  e.opponent.hp = 30;
  e.opponent.hand = [cardCopy(getCardById('def_01')), cardCopy(getCardById('evd_01'))];
  const first = chooseNpcDuelAction(e, 'opponent', () => 0);
  assert.equal(first.cardId, 'evd_01');
  Object.defineProperty(e.player, 'hand', { get() { throw new Error('NPC acessou informação secreta'); }, configurable: true });
  assert.equal(chooseNpcDuelAction(e, 'opponent', () => 0).cardId, 'evd_01');
});

await test('identidade muda prioridades e expert planeja buff e evita técnica suicida', () => {
  const e = duel();
  const attack = getCardById('atk_03');
  const heal = getCardById('tch_02');
  e.player.hp = 200;
  e.player.maxHp = 400;
  assert.ok(scoreNpcAttack(e.player, e.opponent, attack, { identity: 'vegeta' }).score > scoreNpcAttack(e.player, e.opponent, attack, { identity: 'piccolo' }).score);
  assert.ok(scoreNpcTechnique(e.player, e.opponent, heal, { identity: 'piccolo' }) > scoreNpcTechnique(e.player, e.opponent, heal, { identity: 'vegeta' }));
  e.player.hp = 20;
  assert.equal(scoreNpcTechnique(e.player, e.opponent, getCardById('tch_01'), { difficulty: 'expert' }), -Infinity);
  e.player.hp = 400;
  e.opponent.hp = 30;
  const buff = getCardById('tch_04');
  e.player.hand = [cardCopy(buff)];
  const noFollowup = scoreNpcTechnique(e.player, e.opponent, buff, { difficulty: 'expert' });
  e.player.hand.push(cardCopy(getCardById('atk_01')));
  assert.ok(scoreNpcTechnique(e.player, e.opponent, buff, { difficulty: 'expert' }) > noFollowup + 100);
  const options = [{ score: 100, cardId: 'best' }, { score: 10, cardId: 'second' }];
  assert.equal(selectNpcOption(options, { difficulty: 'easy' }, () => 0).cardId, 'second');
  assert.equal(selectNpcOption(options, { difficulty: 'expert' }, () => 0).cardId, 'best');
});

await test('24 partidas completas de NPCs exercitam todos os perfis e níveis sem estado travado', () => {
  const pick = (type, count) => CARD_DATABASE.filter(card => card.type === type).slice(0, count).map(card => card.id);
  const combatDeck = [...pick('attack', 10), ...pick('defense', 3), ...pick('evade', 2), ...pick('counter', 2), ...pick('tech', 3)];
  let seed = 71;
  const rng = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  for (const difficulty of Object.keys(NPC_DIFFICULTIES)) {
    for (const identity of Object.keys(NPC_IDENTITIES)) {
      const e = new ServerDuel();
      e.startMatch('goku', identity, combatDeck, false, { playerDeck: [...combatDeck], opponentDeck: [...combatDeck].reverse(), initiative: 'player' });
      e.player.botDifficulty = e.opponent.botDifficulty = difficulty;
      e.player.botIdentity = 'goku';
      e.opponent.botIdentity = identity;
      let actions = 0;
      while (e.state !== 'GAME_OVER' && actions++ < 2000) {
        if (e.state === 'BEAM_CLASH') {
          const data = e.beamClashData;
          e.resolveBeamClashWinner(data.playerPower >= data.opponentPower ? 'player' : 'opponent');
        } else {
          const actorKey = e.state === 'ATTACK_PENDING' ? e.pendingAttack.attackerKey === 'player' ? 'opponent' : 'player' : e.initiative;
          const action = chooseNpcDuelAction(e, actorKey, rng);
          if (!action) assert.equal(e.resolveUnansweredAttack(), true);
          else if (action.action === 'playCard') assert.equal(e._playCard(actorKey, action.cardIndex, action.cardId), true);
          else if (action.action === 'chargeKi') assert.equal(e._chargeKi(actorKey), true);
          else e._passTurn(actorKey);
        }
        for (const fighter of [e.player, e.opponent]) {
          assert.ok(Number.isFinite(fighter.hp) && fighter.hp >= 0 && fighter.hp <= fighter.maxHp);
          assert.ok(Number.isFinite(fighter.ki) && fighter.ki >= 0 && fighter.ki <= 10);
          assert.ok(fighter.hand.length <= 7);
        }
      }
      assert.equal(e.state, 'GAME_OVER', `${difficulty}/${identity} travou após ${actions} ações`);
      assert.ok(['player', 'opponent'].includes(e.winner));
      e.reset();
    }
  }
});

console.log(`NEXUS COMBAT: ${passed} PASS / 0 FAIL; 714 cartas × 4 motores verificadas.`);
