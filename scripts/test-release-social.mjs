import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  DAILY_QUEST_DEFINITIONS,
  ensureDailyQuestState,
  progressDailyQuestState,
  questView,
  claimDailyQuestState
} from '../js/daily-quest-rules.js';
import { TagTeamEngine } from '../server/tag-team-engine.js';
import { getStarterDeckForLeader, getCardById } from '../js/card-database.js';

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

const teamA = [
  { uid: 'a1', username: 'A1', leader: 'goku', deck: getStarterDeckForLeader('goku') },
  { uid: 'a2', username: 'A2', leader: 'vegeta', deck: getStarterDeckForLeader('vegeta') }
];
const teamB = [
  { uid: 'b1', username: 'B1', leader: 'gohan', deck: getStarterDeckForLeader('gohan') },
  { uid: 'b2', username: 'B2', leader: 'frieza', deck: getStarterDeckForLeader('frieza') }
];

function makeTeam() {
  return new TagTeamEngine({ teamA, teamB, onState: () => {}, onFx: () => {}, onComplete: () => {} });
}

test('existem quatro missoes diarias server-owned', () => {
  assert.equal(DAILY_QUEST_DEFINITIONS.length, 4);
  assert.deepEqual(
    DAILY_QUEST_DEFINITIONS.map(q => q.event).sort(),
    ['online_match', 'online_win', 'pack_open', 'raid_complete']
  );
});

test('daily quests resetam ao mudar a data UTC', () => {
  const old = { date: '2026-09-15', progress: { play_online_2: 2 }, claimed: ['play_online_2'] };
  const next = ensureDailyQuestState(old, '2026-09-16');
  assert.equal(next.date, '2026-09-16');
  assert.deepEqual(next.progress, {});
  assert.deepEqual(next.claimed, []);
});

test('evento progride somente quests correspondentes e respeita target', () => {
  let state = progressDailyQuestState(null, 'online_match', 1, '2026-09-16');
  state = progressDailyQuestState(state, 'online_match', 5, '2026-09-16');
  const view = questView(state, '2026-09-16');
  const play = view.find(q => q.id === 'play_online_2');
  const win = view.find(q => q.id === 'win_online_1');
  assert.equal(play.progress, 2);
  assert.equal(play.completed, true);
  assert.equal(win.progress, 0);
});

test('claim exige conclusao e nao pode ser repetido', () => {
  let state = progressDailyQuestState(null, 'pack_open', 1, '2026-09-16');
  const first = claimDailyQuestState({ zeni: 0, dust: 0, gems: 0 }, state, 'open_pack_1', '2026-09-16');
  assert.equal(first.ok, true);
  assert.equal(first.gems, 1);
  const second = claimDailyQuestState({ zeni: 0, dust: 0, gems: 1 }, first.state, 'open_pack_1', '2026-09-16');
  assert.equal(second.code, 'QUEST_ALREADY_CLAIMED');
});

test('Tag Team exige exatamente quatro jogadores em dois times', () => {
  const e = makeTeam();
  assert.equal(e.teams.A.length, 2);
  assert.equal(e.teams.B.length, 2);
  assert.ok(e.getActiveMember('A'));
  assert.ok(e.getActiveMember('B'));
});

test('reserva nao pode executar acao de combate', () => {
  const e = makeTeam();
  const hp = e.engine.opponent.hp;
  assert.equal(e.action('a2', 'chargeKi'), false);
  assert.equal(e.engine.opponent.hp, hp);
});

test('troca voluntaria muda o ativo e consome o turno', () => {
  const e = makeTeam();
  e.engine.state = 'FREE_ACTION';
  e.engine.initiative = 'player';
  const before = e.getActiveMember('A').uid;
  assert.equal(e.tag(before), true);
  assert.notEqual(e.getActiveMember('A').uid, before);
  assert.equal(e.engine.initiative, 'opponent');
});

test('KO do ativo coloca o reserva automaticamente', () => {
  const e = makeTeam();
  e.engine.state = 'FREE_ACTION';
  e.engine.initiative = 'player';
  e.engine.player.ki = 10;
  e.engine.player.hand = [{ ...getCardById('atk_27'), instanceId: 'kill1' }];
  e.engine.opponent.hp = 10;
  e.engine.opponent.shields = 1;
  const old = e.getActiveMember('B').uid;
  assert.equal(e.action('a1', 'playCard', { cardIndex: 0, cardId: 'atk_27' }), true);
  e.engine.clearReactionTimer();
  e.engine.resolveUnansweredAttack();
  assert.equal(e.teams.B.find(m => m.uid === old).downed, true);
  assert.notEqual(e.getActiveMember('B').uid, old);
  assert.equal(e.finished, false);
});

test('segundo KO do mesmo time encerra a partida', () => {
  const e = makeTeam();
  e.engine.state = 'FREE_ACTION';
  e.engine.initiative = 'player';
  e.engine.player.ki = 10;
  e.engine.player.hand = [{ ...getCardById('atk_27'), instanceId: 'kill1' }];
  e.engine.opponent.hp = 10;
  e.action('a1', 'playCard', { cardIndex: 0, cardId: 'atk_27' });
  e.engine.clearReactionTimer();
  e.engine.resolveUnansweredAttack();

  e.engine.state = 'FREE_ACTION';
  e.engine.initiative = 'player';
  e.engine.player.ki = 10;
  e.engine.player.hand = [{ ...getCardById('atk_27'), instanceId: 'kill2' }];
  e.engine.opponent.hp = 10;
  e.action('a1', 'playCard', { cardIndex: 0, cardId: 'atk_27' });
  e.engine.clearReactionTimer();
  e.engine.resolveUnansweredAttack();

  assert.equal(e.finished, true);
  assert.equal(e.teamWinner, 'A');
});

test('projecao de 2v2 esconde mao do companheiro ativo do reserva', () => {
  const e = makeTeam();
  const state = e.getStateFor('a2');
  assert.equal(state.teamSide, 'A');
  assert.equal(state.you.active, false);
  assert.equal(state.duel.player.hand.every(card => card.hidden === true), true);
  assert.equal(Array.isArray(state.you.hand), true);
});

test('abandono dos dois membros entrega vitoria ao outro time', () => {
  const e = makeTeam();
  assert.equal(e.abandon('a1'), true);
  assert.equal(e.abandon('a2'), true);
  assert.equal(e.finished, true);
  assert.equal(e.teamWinner, 'B');
});

test('servidor registra 2v2 ranked e salas privadas 1v1/2v2', () => {
  const src = fs.readFileSync(new URL('../server/product-modes.js', import.meta.url), 'utf8');
  assert.ok(src.includes("join_2v2_matchmaking"));
  assert.ok(src.includes("create_private_room"));
  assert.ok(src.includes("join_private_room"));
  assert.ok(src.includes("startPrivateDuel"));
  assert.ok(src.includes("startTeamRoom"));
});

test('2v2 ranked usa resultado server-side para os quatro jogadores', () => {
  const src = fs.readFileSync(new URL('../server/product-modes.js', import.meta.url), 'utf8');
  assert.ok(src.includes('updateRankedTeamUser'));
  assert.ok(src.includes('applyRankedResult'));
  assert.ok(src.includes('finalizeTeamRoom'));
});

test('Dojos sao persistentes e tem limite de 30 membros', () => {
  const model = fs.readFileSync(new URL('../server/dojo-model.js', import.meta.url), 'utf8');
  const modes = fs.readFileSync(new URL('../server/product-modes.js', import.meta.url), 'utf8');
  assert.ok(model.includes('ownerUid'));
  assert.ok(model.includes('members'));
  assert.ok(modes.includes('DOJO_MAX_MEMBERS = 30'));
  assert.ok(modes.includes("/api/dojos/create"));
  assert.ok(modes.includes("/api/dojos/join"));
  assert.ok(modes.includes("/api/dojos/leave"));
});

test('modelo de usuario persiste dojo e estado diario', () => {
  const src = fs.readFileSync(new URL('../server/user-model.js', import.meta.url), 'utf8');
  assert.ok(src.includes('dojoId'));
  assert.ok(src.includes('dailyQuests'));
});

test('UI deixou de usar DOJO_RANKINGS mock e missao estatica', () => {
  const ui = fs.readFileSync(new URL('../js/ui-manager.js', import.meta.url), 'utf8');
  const chat = fs.readFileSync(new URL('../js/chat-manager.js', import.meta.url), 'utf8');
  assert.equal(ui.includes('DOJO_RANKINGS'), false);
  assert.equal(chat.includes('DOJO_RANKINGS'), false);
  assert.ok(ui.includes('socialManager.renderQuests'));
  assert.ok(ui.includes('socialManager.renderDojos'));
});

test('cliente possui matchmaking 2v2 e private rooms reais', () => {
  const src = fs.readFileSync(new URL('../js/multiplayer-manager.js', import.meta.url), 'utf8');
  assert.ok(src.includes('startRanked2v2Matchmaking'));
  assert.ok(src.includes('createPrivateRoom'));
  assert.ok(src.includes('joinPrivateRoom'));
  assert.ok(src.includes("socketManager.emit('team_action'"));
});

test('server.js registra modulo de produto e eventos de quest', () => {
  const src = fs.readFileSync(new URL('../server.js', import.meta.url), 'utf8');
  assert.ok(src.includes('registerProductModes(app, io)'));
  assert.ok(src.includes("applyQuestEventToUser(user, 'online_match')"));
  assert.ok(src.includes("applyQuestEventToUser(user, 'pack_open')"));
  assert.ok(src.includes("applyQuestEventToUser(user, 'raid_complete')"));
});

console.log('SOCIAL MODES RELEASE TESTS: ' + passed + ' PASS / 0 FAIL');
