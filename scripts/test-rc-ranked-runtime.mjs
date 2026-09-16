import assert from 'node:assert/strict';
import fs from 'node:fs';
import { getStarterDeckForLeader } from '../js/card-database.js';
import { createDefaultInventory, validateDeck } from '../js/economy-rules.js';

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

test('server importa getStarterDeckForLeader usado no perfil ranked', () => {
  const src = fs.readFileSync(new URL('../server.js', import.meta.url), 'utf8');
  assert.ok(src.includes("import { getStarterDeckForLeader } from './js/card-database.js';"));
  assert.ok(src.includes('getStarterDeckForLeader(leader)'));
});

test('starter decks dos quatro lideres iniciais existem e sao validos', () => {
  const leaders = ['goku', 'vegeta', 'gohan', 'frieza'];
  const inv = createDefaultInventory(leaders);

  for (const leader of leaders) {
    const deck = getStarterDeckForLeader(leader);
    assert.ok(Array.isArray(deck));
    assert.ok(deck.length >= 10 && deck.length <= 20);
    assert.equal(validateDeck(deck, inv, leader, leaders).ok, true);
  }
});

test('join_matchmaking protege falha async de loadRankedProfile', () => {
  const src = fs.readFileSync(new URL('../server.js', import.meta.url), 'utf8');
  const start = src.indexOf("socket.on('join_matchmaking', async payload => {");
  assert.ok(start >= 0);
  const block = src.slice(start, start + 5000);
  assert.ok(block.includes('try {'));
  assert.ok(block.includes('profile = await loadRankedProfile('));
  assert.ok(block.includes("code: 'PROFILE_LOAD_FAILED'"));
  assert.ok(block.includes("console.error('[Ranked] Profile load error:'"));
});

test('matchmaking ainda rejeita conta nao autenticada', () => {
  const src = fs.readFileSync(new URL('../server.js', import.meta.url), 'utf8');
  const start = src.indexOf("socket.on('join_matchmaking', async payload => {");
  const block = src.slice(start, start + 1800);
  assert.ok(block.includes("code: 'AUTH_REQUIRED'"));
});

console.log(`RC RANKED RUNTIME TESTS: ${passed} PASS / 0 FAIL`);
