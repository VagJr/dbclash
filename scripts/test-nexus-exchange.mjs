import assert from 'node:assert/strict';
import { reserveExchange, settleExchange, cancelExchange, transferableCopies } from '../js/exchange-rules.js';
import { CARD_DATABASE } from '../js/card-database.js';
import { craftCardState, openPackState, totalCardCopies, migrateLegacyInventory } from '../js/economy-rules.js';

const card = CARD_DATABASE.find(c => c.set === 'NXS')?.id || 'atk_01';
const other = CARD_DATABASE.find(c => c.set === 'NXS' && c.id !== card)?.id || 'atk_02';
const profile = (uid, overrides = {}) => ({ uid, isGuest: false, zeni: 500, unlockedLeaders: [], customDecks: {}, cardInventory: { [card]: 2, [other]: 1 }, ...overrides });
const listing = { sellerUid: 'seller', kind: 'sale', cardId: card, price: 300, status: 'open', expiresAt: new Date(Date.now() + 60000) };
let passed = 0;
function test(name, run) { run(); passed++; console.log('PASS', name); }
const rejects = (work, code) => assert.throws(work, error => error.code === code);

test('sale reserves one physical card before it is offered', () => {
  const seller = profile('seller'); const state = reserveExchange(seller, listing);
  assert.equal(state.cardInventory[card], 1); assert.equal(seller.cardInventory[card], 2);
});
test('copies across every custom deck remain protected', () => {
  assert.equal(transferableCopies(profile('seller', { customDecks: { goku: [card], vegeta: [card, card] } }), card), 0);
  rejects(() => reserveExchange(profile('seller', { customDecks: { goku: [card, card] } }), listing), 'CARD_RESERVED');
});
test('starter migration cannot recreate a negotiated initial entitlement', () => {
  const starter = profile('seller', { unlockedLeaders: ['goku'], cardInventory: { atk_01: 3 } });
  assert.equal(transferableCopies(starter, 'atk_01'), 0);
  rejects(() => reserveExchange(starter, { ...listing, cardId: 'atk_01' }), 'CARD_RESERVED');
  rejects(() => reserveExchange({ ...starter, unlockedLeaders: [] }, { ...listing, cardId: 'atk_01' }), 'CARD_RESERVED');
});
test('market rejects guest accounts and fractional or negative prices', () => {
  rejects(() => reserveExchange(profile('guest', { isGuest: true }), listing), 'ACCOUNT_REQUIRED');
  for (const price of [-1, 0, 1.5, NaN, 100001]) rejects(() => reserveExchange(profile('seller'), { ...listing, price }), 'INVALID_PRICE');
});
test('sale conserves total Zeni and settles escrow to a buyer once', () => {
  const seller = reserveExchange(profile('seller'), listing); const buyer = profile('buyer', { cardInventory: {} });
  const result = settleExchange(listing, seller, buyer);
  assert.equal(result.seller.zeni + result.buyer.zeni, seller.zeni + buyer.zeni);
  assert.equal(result.seller.zeni, 800); assert.equal(result.buyer.zeni, 200);
  assert.equal(result.buyer.cardInventory[card], 1);
  rejects(() => settleExchange({ ...listing, status: 'completed' }, result.seller, result.buyer), 'LISTING_CLOSED');
});
test('failed purchase leaves both input inventories and wallets untouched', () => {
  const seller = profile('seller'); const buyer = profile('buyer', { zeni: 299 });
  const before = JSON.stringify([seller, buyer]);
  rejects(() => settleExchange(listing, seller, buyer), 'NOT_ENOUGH_ZENI');
  assert.equal(JSON.stringify([seller, buyer]), before);
});
test('full inventory, self purchase, and wrong seller are rejected', () => {
  rejects(() => settleExchange(listing, profile('seller'), profile('buyer', { cardInventory: { [card]: 3 } })), 'COPY_LIMIT');
  rejects(() => settleExchange(listing, profile('seller'), profile('seller')), 'INVALID_PARTICIPANT');
  rejects(() => settleExchange(listing, profile('intruder'), profile('buyer')), 'INVALID_PARTICIPANT');
});
test('expired listing cannot transfer cards', () => {
  rejects(() => settleExchange({ ...listing, expiresAt: new Date(0) }, profile('seller'), profile('buyer')), 'LISTING_EXPIRED');
});
test('trade conserves both card types without changing currency', () => {
  const offer = { ...listing, kind: 'trade', requestedCardId: other };
  const seller = reserveExchange(profile('seller', { cardInventory: { [card]: 1 } }), offer);
  const buyer = profile('buyer', { cardInventory: { [other]: 1 } });
  const state = settleExchange(offer, seller, buyer);
  assert.equal(state.seller.cardInventory[other], 1); assert.equal(state.buyer.cardInventory[card], 1);
  assert.equal(state.seller.cardInventory[card] || 0, 0); assert.equal(state.buyer.cardInventory[other] || 0, 0);
  assert.equal(state.seller.zeni, 500); assert.equal(state.buyer.zeni, 500);
});
test('trade cannot steal a requested copy out of a saved deck', () => {
  rejects(() => settleExchange({ ...listing, kind: 'trade', requestedCardId: other }, profile('seller'),
    profile('buyer', { customDecks: { goku: [other] } })), 'CARD_RESERVED');
});
test('cancellation restores exactly one escrow copy and never pays Zeni', () => {
  const seller = profile('seller'); const held = reserveExchange(seller, listing);
  const restored = cancelExchange(listing, held);
  assert.deepEqual(restored.cardInventory, seller.cardInventory); assert.equal(restored.zeni, seller.zeni);
  rejects(() => cancelExchange({ ...listing, status: 'cancelled' }, restored), 'LISTING_CLOSED');
  rejects(() => cancelExchange(listing, profile('intruder')), 'LISTING_CLOSED');
});
test('craft and boosters count escrow capacity so cancellation is always recoverable', () => {
  const seller = profile('seller', { cardInventory: { [card]: 3 }, dust: 5000 });
  const held = reserveExchange(seller, listing);
  assert.equal(totalCardCopies(held, card), 3);
  assert.equal(craftCardState(held, card).code, 'COPY_LIMIT');
  const pack = openPackState(held, [card, card, card]);
  assert.equal(pack.cardInventory[card], 2);
  assert.equal(pack.results.reduce((sum, pull) => sum + pull.overflow, 0), 3);
  const restored = cancelExchange(listing, { ...held, ...pack });
  assert.equal(restored.cardInventory[card], 3);
  assert.equal(restored.escrowInventory[card] || 0, 0);
});
test('purchase capacity includes buyers own escrow and legacy seeding respects it', () => {
  const buyer = profile('buyer', { cardInventory: { [card]: 2 }, escrowInventory: { [card]: 1 } });
  rejects(() => settleExchange(listing, profile('seller'), buyer), 'COPY_LIMIT');
  const legacy = migrateLegacyInventory({ unlockedLeaders: ['goku'], cardInventory: { atk_01: 2 }, escrowInventory: { atk_01: 1 } });
  assert.equal(legacy.atk_01, 2);
});
console.log(`NEXUS EXCHANGE: ${passed} PASS / 0 FAIL. Database concurrency requires replica-set integration QA.`);
