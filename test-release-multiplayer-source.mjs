import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  RANKED_WIN_RP,
  RANKED_LOSS_RP,
  RANKED_WIN_XP,
  RANKED_LOSS_XP,
  RECONNECT_GRACE_MS,
  divisionForRp,
  levelForXp,
  applyRankedResult
} from '../js/ranked-rules.js';

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

test('ranked usa delta canonico +25/-15 e XP 150/50', () => {
  assert.equal(RANKED_WIN_RP, 25);
  assert.equal(RANKED_LOSS_RP, 15);
  assert.equal(RANKED_WIN_XP, 150);
  assert.equal(RANKED_LOSS_XP, 50);
});

test('resultado ranked atualiza RP XP nivel e W/L', () => {
  const base = { rankPoints: 1000, xp: 450, victories: 2, losses: 3 };
  const win = applyRankedResult(base, true);
  assert.equal(win.rankPoints, 1025);
  assert.equal(win.xp, 600);
  assert.equal(win.level, 2);
  assert.equal(win.victories, 3);
  assert.equal(win.losses, 3);

  const loss = applyRankedResult(base, false);
  assert.equal(loss.rankPoints, 985);
  assert.equal(loss.xp, 500);
  assert.equal(loss.level, 2);
  assert.equal(loss.losses, 4);
});

test('RP nunca fica negativo', () => {
  assert.equal(applyRankedResult({ rankPoints: 5, xp: 0 }, false).rankPoints, 0);
});

test('divisoes preservam os thresholds existentes', () => {
  assert.equal(divisionForRp(0), 'Bronze I');
  assert.equal(divisionForRp(1200), 'Prata III');
  assert.equal(divisionForRp(1500), 'Ouro II');
  assert.equal(divisionForRp(1800), 'Platina I');
  assert.equal(divisionForRp(2700), 'Mestre Z');
  assert.equal(divisionForRp(3300), 'Grandmaster Kami');
});

test('nivel progride a cada 500 XP', () => {
  assert.equal(levelForXp(0), 1);
  assert.equal(levelForXp(499), 1);
  assert.equal(levelForXp(500), 2);
  assert.equal(levelForXp(1500), 4);
});

test('grace de reconexao e 30 segundos', () => {
  assert.equal(RECONNECT_GRACE_MS, 30000);
});

test('SocketManager persiste listeners e usa token no handshake', () => {
  const src = fs.readFileSync(new URL('../js/socket-config.js', import.meta.url), 'utf8');
  assert.ok(src.includes('this.listeners = new Map()'));
  assert.ok(src.includes("auth: { token: this.authToken || null }"));
  assert.ok(src.includes('attachRegisteredListeners'));
  assert.ok(src.includes('setAuthToken(token)'));
});

test('cliente ranked nao envia uid deck ou username como autoridade', () => {
  const src = fs.readFileSync(new URL('../js/multiplayer-manager.js', import.meta.url), 'utf8');
  const joinBlock = src.slice(src.indexOf("socketManager.emit('join_matchmaking'"), src.indexOf("socketManager.emit('leave_matchmaking'"));
  assert.ok(joinBlock.includes('leader: this.pendingLeaderKey'));
  assert.equal(joinBlock.includes('deck:'), false);
  assert.equal(joinBlock.includes('uid:'), false);
  assert.equal(joinBlock.includes('username:'), false);
});

test('cliente envia sequencia monotona de comandos', () => {
  const src = fs.readFileSync(new URL('../js/multiplayer-manager.js', import.meta.url), 'utf8');
  assert.ok(src.includes('this.actionSeq += 1'));
  assert.ok(src.includes('seq: this.actionSeq'));
});

test('cliente descarta state_update antigo por stateVersion', () => {
  const src = fs.readFileSync(new URL('../js/multiplayer-manager.js', import.meta.url), 'utf8');
  assert.ok(src.includes('version < this.latestStateVersion'));
});

test('servidor autentica socket com verifySessionToken', () => {
  const src = fs.readFileSync(new URL('../server.js', import.meta.url), 'utf8');
  assert.ok(src.includes('io.use(async (socket, next)'));
  assert.ok(src.includes('verifySessionToken'));
  assert.ok(src.includes("socket.authUid"));
});

test('servidor carrega e valida deck da conta', () => {
  const src = fs.readFileSync(new URL('../server.js', import.meta.url), 'utf8');
  assert.ok(src.includes('validateDeck'));
  assert.ok(src.includes('user.customDecks'));
  assert.equal(src.includes('socket.userData.deck'), false);
});

test('servidor mantem room durante grace e suporta resume', () => {
  const src = fs.readFileSync(new URL('../server.js', import.meta.url), 'utf8');
  assert.ok(src.includes('RECONNECT_GRACE_MS'));
  assert.ok(src.includes('match_resumed'));
  assert.ok(src.includes('opponent_reconnecting'));
  assert.ok(src.includes('opponent_reconnected'));
});

test('resultado ranked nasce do GAME_OVER do engine', () => {
  const src = fs.readFileSync(new URL('../server.js', import.meta.url), 'utf8');
  assert.ok(src.includes("eng.state === 'GAME_OVER'"));
  assert.ok(src.includes('finalizeRankedRoom'));
});

test('leaderboard fake foi removido', () => {
  const src = fs.readFileSync(new URL('../js/leaderboard-manager.js', import.meta.url), 'utf8');
  assert.equal(src.includes('MOCK_GLOBAL_LEADERBOARD'), false);
  assert.ok(src.includes('authManager.fetchLeaderboard()'));
});

test('chat de sala exige membership e limita tamanho', () => {
  const src = fs.readFileSync(new URL('../server.js', import.meta.url), 'utf8');
  assert.ok(src.includes('text.slice(0, 300)'));
  assert.ok(src.includes('socket.roomCode !== requestedRoom'));
});

console.log('MULTIPLAYER RELEASE TESTS: ' + passed + ' PASS / 0 FAIL');
