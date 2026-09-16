import assert from 'node:assert/strict';
import fs from 'node:fs';

process.env.AUTH_SECRET = 'release-test-secret';

import {
  DECK_MIN,
  DECK_MAX,
  MAX_CARD_COPIES,
  PACK_COST,
  createDefaultInventory,
  validateDeck,
  craftCardState,
  unlockLeaderState,
  openPackState,
  migrateLegacyInventory
} from '../js/economy-rules.js';
import { CARD_DATABASE, getStarterDeckForLeader } from '../js/card-database.js';
import { createSessionToken, verifySessionToken } from '../server/auth-session.js';

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

test('token assinado valida e token adulterado falha', () => {
  const token = createSessionToken({ uid: 'user_1' }, 1000);
  assert.equal(verifySessionToken(token, 1001).uid, 'user_1');
  const tampered = token.slice(0, -1) + (token.endsWith('a') ? 'b' : 'a');
  assert.equal(verifySessionToken(tampered, 1001), null);
});

test('token expirado falha', () => {
  const token = createSessionToken({ uid: 'user_2' }, 1000);
  assert.equal(verifySessionToken(token, 1000 + 60 * 60 * 24 * 31), null);
});

test('inventario inicial cobre os starter decks dos quatro lideres iniciais', () => {
  const leaders = ['goku', 'vegeta', 'gohan', 'frieza'];
  const inv = createDefaultInventory(leaders);
  for (const leader of leaders) {
    const deck = getStarterDeckForLeader(leader);
    assert.equal(validateDeck(deck, inv, leader, leaders).ok, true);
  }
});

test('deck exige 10-20 cartas', () => {
  const inv = createDefaultInventory();
  assert.equal(validateDeck(Array(DECK_MIN - 1).fill('atk_01'), inv, 'goku').ok, false);
  assert.equal(validateDeck(Array(DECK_MAX + 1).fill('atk_01'), inv, 'goku').ok, false);
});

test('deck rejeita carta desconhecida e lider bloqueado', () => {
  const inv = createDefaultInventory();
  const deck = [...getStarterDeckForLeader('goku')];
  deck[0] = 'fake_999';
  assert.equal(validateDeck(deck, inv, 'goku').code, 'UNKNOWN_CARD');
  assert.equal(validateDeck(getStarterDeckForLeader('piccolo'), inv, 'piccolo').code, 'LEADER_LOCKED');
});

test('deck rejeita mais de 3 copias', () => {
  const inv = createDefaultInventory();
  inv.atk_01 = MAX_CARD_COPIES;
  const deck = [...getStarterDeckForLeader('goku')];
  deck.splice(0, 4, 'atk_01', 'atk_01', 'atk_01', 'atk_01');
  assert.equal(validateDeck(deck, inv, 'goku').code, 'COPY_LIMIT');
});

test('deck rejeita mais copias do que o inventario possui', () => {
  const leaders = ['goku'];
  const inv = createDefaultInventory(leaders);
  const deck = [...getStarterDeckForLeader('goku')];
  const target = deck.find(id => (inv[id] || 0) === 1);
  const idx = deck.findIndex(id => id !== target);
  deck[idx] = target;
  assert.equal(validateDeck(deck, inv, 'goku', leaders).code, 'NOT_OWNED');
});

test('craft desconta Dust e adiciona uma copia', () => {
  const card = CARD_DATABASE.find(c => c.rarity === 'common');
  const profile = { dust: 999, cardInventory: {} };
  const result = craftCardState(profile, card.id);
  assert.equal(result.ok, true);
  assert.equal(result.cardInventory[card.id], 1);
  assert.ok(result.dust < 999);
});

test('craft respeita limite de copias', () => {
  const card = CARD_DATABASE[0];
  const profile = { dust: 9999, cardInventory: { [card.id]: MAX_CARD_COPIES } };
  assert.equal(craftCardState(profile, card.id).code, 'COPY_LIMIT');
});

test('unlock desconta Zeni e concede starter do novo lider', () => {
  const profile = {
    zeni: 5000,
    unlockedLeaders: ['goku', 'vegeta', 'gohan', 'frieza'],
    cardInventory: createDefaultInventory()
  };
  const result = unlockLeaderState(profile, 'piccolo');
  assert.equal(result.ok, true);
  assert.ok(result.zeni < 5000);
  assert.ok(result.unlockedLeaders.includes('piccolo'));
  assert.equal(validateDeck(
    getStarterDeckForLeader('piccolo'),
    result.cardInventory,
    'piccolo',
    result.unlockedLeaders
  ).ok, true);
});

test('pack desconta 300 Zeni e nunca excede 3 copias', () => {
  const id = CARD_DATABASE[0].id;
  const profile = { zeni: 1000, dust: 0, cardInventory: { [id]: MAX_CARD_COPIES } };
  const result = openPackState(profile, [id, id, id]);
  assert.equal(result.ok, true);
  assert.equal(result.zeni, 1000 - PACK_COST);
  assert.equal(result.cardInventory[id], MAX_CARD_COPIES);
  assert.ok(result.dust > 0);
});

test('migracao legada preserva ownedCards e torna starters validos', () => {
  const old = {
    ownedCards: ['atk_27'],
    unlockedLeaders: ['goku', 'vegeta', 'gohan', 'frieza']
  };
  const inv = migrateLegacyInventory(old);
  assert.equal(inv.atk_27 >= 1, true);
  assert.equal(validateDeck(getStarterDeckForLeader('goku'), inv, 'goku', old.unlockedLeaders).ok, true);
});

test('AuthManager nao possui fallback que transforma falha de rede em login', () => {
  const src = fs.readFileSync(new URL('../js/auth-manager.js', import.meta.url), 'utf8');
  assert.equal(src.includes('isGuest: false') && src.includes('Online login failed'), false);
  assert.ok(src.includes('Login online nao pode ser simulado localmente'));
});

test('AuthDatabase local com btoa foi aposentado', () => {
  const src = fs.readFileSync(new URL('../js/auth-database.js', import.meta.url), 'utf8');
  assert.equal(src.includes('btoa('), false);
  assert.ok(src.includes('Legacy compatibility adapter'));
});

test('servidor nao aceita mais initialData no cadastro nem $set userData', () => {
  const src = fs.readFileSync(new URL('../server.js', import.meta.url), 'utf8');
  assert.equal(src.includes('...(initialData || {})'), false);
  assert.equal(src.includes('{ $set: userData }'), false);
  assert.ok(src.includes("requireSession"));
});

test('pack e craft online passam por endpoints de economia', () => {
  const pack = fs.readFileSync(new URL('../js/pack-opener.js', import.meta.url), 'utf8');
  const auth = fs.readFileSync(new URL('../js/auth-manager.js', import.meta.url), 'utf8');
  assert.equal(pack.includes('Math.random'), false);
  assert.ok(auth.includes('/api/economy/open-pack'));
  assert.ok(auth.includes('/api/economy/craft'));
});

console.log('ACCOUNT RELEASE TESTS: ' + passed + ' PASS / 0 FAIL');
