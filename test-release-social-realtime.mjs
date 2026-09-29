import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  DAILY_QUEST_DEFINITIONS,
  ensureDailyQuestState,
  progressDailyQuestState,
  questView,
  claimDailyQuestState
} from '../js/daily-quest-rules.js';
import { SquadBattleEngine } from '../server/squad-battle-engine.js';
import { getStarterDeckForLeader, getCardById } from '../js/card-database.js';

let passed = 0;
function test(name, fn) { try { fn(); passed++; console.log('PASS', name); } catch (err) { console.error('FAIL', name); throw err; } }

const teamA = [
  { uid: 'a1', username: 'A1', leader: 'goku', deck: getStarterDeckForLeader('goku') },
  { uid: 'a2', username: 'A2', leader: 'vegeta', deck: getStarterDeckForLeader('vegeta') }
];
const teamB = [
  { uid: 'b1', username: 'B1', leader: 'gohan', deck: getStarterDeckForLeader('gohan') },
  { uid: 'b2', username: 'B2', leader: 'frieza', deck: getStarterDeckForLeader('frieza') }
];
const makeTeam = () => new SquadBattleEngine({ teamA, teamB, onState: () => {}, onFx: () => {}, onComplete: () => {} });

test('existem quatro missoes diarias server-owned', () => {
  assert.equal(DAILY_QUEST_DEFINITIONS.length, 4);
  assert.deepEqual(DAILY_QUEST_DEFINITIONS.map(q => q.event).sort(), ['online_match', 'online_win', 'pack_open', 'raid_complete']);
});

test('daily quests resetam ao mudar a data UTC', () => {
  const old = { date: '2026-09-15', progress: { play_online_2: 2 }, claimed: ['play_online_2'] };
  const next = ensureDailyQuestState(old, '2026-09-16');
  assert.equal(next.date, '2026-09-16');
  assert.deepEqual(next.progress, {});
  assert.deepEqual(next.claimed, []);
});

test('evento progride quests correspondentes', () => {
  let state = progressDailyQuestState(null, 'online_match', 1, '2026-09-16');
  state = progressDailyQuestState(state, 'online_match', 5, '2026-09-16');
  const view = questView(state, '2026-09-16');
  assert.equal(view.find(q => q.id === 'play_online_2').completed, true);
});

test('claim exige conclusao e nao repete', () => {
  let state = progressDailyQuestState(null, 'pack_open', 1, '2026-09-16');
  const first = claimDailyQuestState({ zeni: 0, dust: 0, gems: 0 }, state, 'open_pack_1', '2026-09-16');
  assert.equal(first.ok, true);
  const second = claimDailyQuestState({ zeni: 0, dust: 0, gems: 1 }, first.state, 'open_pack_1', '2026-09-16');
  assert.equal(second.code, 'QUEST_ALREADY_CLAIMED');
});

test('2v2 possui quatro lutadores presentes simultaneamente', () => {
  const e = makeTeam();
  assert.equal(e.teams.A.length, 2);
  assert.equal(e.teams.B.length, 2);
  assert.equal(typeof e.activeIndex, 'undefined');
  assert.equal(e.state, 'ACTIVE');
});

test('os dois membros do mesmo time podem agir sem tag', () => {
  const e = makeTeam();
  e.getMember('a1').member.actionReadyAt = 0;
  e.getMember('a2').member.actionReadyAt = 0;
  assert.equal(e.chargeKi('a1'), true);
  assert.equal(e.chargeKi('a2'), true);
});

test('ataque exige targetUid inimigo valido', () => {
  const e = makeTeam();
  const p = e.getMember('a1').member;
  p.actionReadyAt = 0;
  p.ki = 10;
  p.hand = [{ ...getCardById('atk_01'), instanceId: 'x' }];
  assert.equal(e.action('a1', 'playCard', { cardIndex: 0, cardId: 'atk_01' }), false);
  assert.equal(e.action('a1', 'playCard', { cardIndex: 0, cardId: 'atk_01', targetUid: 'a2' }), false);
  assert.equal(e.action('a1', 'playCard', { cardIndex: 0, cardId: 'atk_01', targetUid: 'b1' }), true);
});

test('KO individual nao remove companheiro do campo', () => {
  const e = makeTeam();
  e.getMember('b1').member.hp = 0;
  e.getMember('b1').member.downed = true;
  assert.equal(e.getAlive('B').some(p => p.uid === 'b2'), true);
  assert.equal(e.finished, false);
});

test('dois KOs do mesmo time encerram partida', () => {
  const e = makeTeam();
  e.abandon('b1');
  e.abandon('b2');
  assert.equal(e.finished, true);
  assert.equal(e.teamWinner, 'A');
});

test('projecao 2v2 mostra quatro HUDs e apenas propria mao', () => {
  const e = makeTeam();
  const state = e.getStateFor('a1');
  assert.equal(state.mode, '2v2-realtime');
  assert.equal(state.teams.A.length + state.teams.B.length, 4);
  assert.ok(Array.isArray(state.you.hand));
  assert.equal(state.teams.A.some(p => Object.prototype.hasOwnProperty.call(p, 'hand')), false);
});

test('product modes usa SquadBattleEngine e SquadBotController', () => {
  const src = fs.readFileSync(new URL('../server/product-modes.js', import.meta.url), 'utf8');
  assert.ok(src.includes('SquadBattleEngine'));
  assert.ok(src.includes('SquadBotController'));
  assert.equal(src.includes('new TagTeamEngine'), false);
});

test('cliente 2v2 possui selecao explicita de alvo', () => {
  const src = fs.readFileSync(new URL('../js/team-ui.js', import.meta.url), 'utf8');
  assert.ok(src.includes('selectedTargetUid'));
  assert.ok(src.includes('targetUid'));
  assert.ok(src.includes('4 LUTADORES EM CAMPO'));
});

test('Dojos persistentes continuam registrados', () => {
  const modes = fs.readFileSync(new URL('../server/product-modes.js', import.meta.url), 'utf8');
  assert.ok(modes.includes('DOJO_MAX_MEMBERS = 30'));
  assert.ok(modes.includes('/api/dojos/create'));
  assert.ok(modes.includes('/api/dojos/join'));
});

test('cliente continua com matchmaking 2v2 e salas privadas', () => {
  const src = fs.readFileSync(new URL('../js/multiplayer-manager.js', import.meta.url), 'utf8');
  assert.ok(src.includes('startRanked2v2Matchmaking'));
  assert.ok(src.includes('createPrivateRoom'));
  assert.ok(src.includes("socketManager.emit('team_action'"));
});

test('server registra product modes e quests', () => {
  const src = fs.readFileSync(new URL('../server.js', import.meta.url), 'utf8');
  assert.ok(src.includes('registerProductModes(app, io)'));
  assert.ok(src.includes("applyQuestEventToUser(user, 'raid_complete')"));
});

console.log(`SOCIAL MODES RELEASE TESTS: ${passed} PASS / 0 FAIL`);
