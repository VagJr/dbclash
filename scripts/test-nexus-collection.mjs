import assert from 'node:assert/strict';
import fs from 'node:fs';
import { webcrypto } from 'node:crypto';

globalThis.window = { crypto: webcrypto };
import { CARD_DATABASE, LEGACY_CARD_DATABASE, LEADERS, getCardById, getStarterDeckForLeader } from '../js/card-database.js';
import { NEXUS_CARDS, NEXUS_ROSTER, SUPPORTED_NEXUS_RULES, ATLAS_COLUMNS, ATLAS_ROWS, ATLAS_CAPACITY, atlasPosition, collectionSummary } from '../js/collection-nexus.js';
import { getCardRule, getEffectiveCardCost, isAttackAction, isImmediateTechnique, canUseReaction } from '../js/content-rules.js';
import { GameEngine as ServerDuel } from '../server/server-engine.js';
import { GameEngine as LocalDuel } from '../js/game-engine.js';
import { createDefaultInventory, validateDeck, craftCardState, CRAFT_COST, rollPack } from '../js/economy-rules.js';

let passed = 0;
function test(name, fn) {
  fn();
  passed++;
  console.log('PASS', name);
}
function signature(card) {
  return JSON.stringify([card.type, card.cost, card.power, card.block || 0, !!card.isCombo, !!card.isBeam, card.damageKind || null, Object.entries(getCardRule(card)).sort(([a], [b]) => a.localeCompare(b))]);
}
function makeDuel(Engine) {
  const engine = new Engine(() => {}, () => {});
  engine.startMatch('piccolo', 'vegeta', [], false);
  engine.clearReactionTimer();
  engine.clearBeamClashLoop();
  engine.state = 'FREE_ACTION';
  engine.initiative = 'player';
  engine.player.leader = { ...LEADERS.piccolo };
  engine.player.ki = 10;
  engine.player.hp = 300;
  engine.player.shields = 6;
  engine.player.deck = Array(12).fill('atk_01');
  engine.opponent.ki = 10;
  engine.opponent.hand = [{ ...getCardById('def_01'), instanceId: 'guard' }];
  engine.opponent.deck = Array(12).fill('atk_01');
  return engine;
}
function instance(card) { return { ...card, instanceId: `${card.id}_test` }; }

// Mechanical fingerprints intentionally ignore names, lore, rarity and art.
test('714 identities, names and executable mechanical signatures are unique', () => {
  assert.equal(CARD_DATABASE.length, 714);
  assert.equal(LEGACY_CARD_DATABASE.length, 70);
  assert.equal(NEXUS_CARDS.length, 644);
  assert.equal(NEXUS_ROSTER.length, 28);
  assert.equal(new Set(CARD_DATABASE.map(card => card.id)).size, 714);
  assert.equal(new Set(CARD_DATABASE.map(card => card.name)).size, 714);
  assert.equal(new Set(CARD_DATABASE.map(signature)).size, 714);
  for (const legacy of LEGACY_CARD_DATABASE) {
    const current = getCardById(legacy.id);
    for (const [field, value] of Object.entries(legacy)) assert.deepEqual(current[field], value, `${legacy.id}.${field}`);
  }
});

test('every new card uses bounded, implemented effects and consistent descriptions', () => {
  const allowed = new Set(SUPPORTED_NEXUS_RULES);
  for (const card of NEXUS_CARDS) {
    assert.ok(card.cost >= 1 && card.cost <= 10, card.id);
    assert.ok(Number.isFinite(card.power) && card.power >= 0, card.id);
    assert.ok(card.descPt && card.descEn && card.artPrompt && card.archetypes.length, card.id);
    assert.ok(Object.keys(getCardRule(card)).length > 0, card.id);
    assert.deepEqual(getCardRule(card), card.rules);
    for (const [key, value] of Object.entries(card.rules)) {
      assert.ok(allowed.has(key), `${card.id}: unsupported ${key}`);
      assert.ok(typeof value === 'boolean' || Number.isFinite(value), `${card.id}: invalid ${key}`);
    }
    assert.equal(isAttackAction(card), card.type === 'attack');
    assert.equal(isImmediateTechnique(card), card.type === 'tech');
  }
  for (const archetype of ['aggro', 'defense', 'healing', 'control', 'combo', 'beam']) {
    assert.ok(CARD_DATABASE.filter(card => card.archetypes.includes(archetype)).length >= 28, archetype);
  }
});

test('fifteen 7x7 sheets map all 714 cards exactly once with 21 final blanks', () => {
  const summary = collectionSummary(CARD_DATABASE);
  assert.equal(ATLAS_COLUMNS, 7);
  assert.equal(ATLAS_ROWS, 7);
  assert.equal(ATLAS_CAPACITY, 49);
  assert.equal(summary.sheets, 15);
  assert.equal(summary.emptySlots, 21);
  const cells = new Set();
  for (let index = 0; index < CARD_DATABASE.length; index++) {
    const card = CARD_DATABASE[index];
    const position = atlasPosition(index);
    assert.equal(card.setNumber, index + 1);
    assert.equal(card.art.sheet, position.sheet);
    assert.equal(card.art.row, position.row);
    assert.equal(card.art.column, position.column);
    assert.equal(card.art.row * ATLAS_COLUMNS + card.art.column, card.art.slot);
    cells.add(`${position.sheet}:${position.slot}`);
    assert.equal(card.art.officialLicensed, false);
  }
  assert.equal(cells.size, 714);
  assert.equal(CARD_DATABASE.at(-1).art.slot, 27);
  const manifest = JSON.parse(fs.readFileSync(new URL('../assets/rework/art-manifest.json', import.meta.url), 'utf8'));
  assert.equal(manifest.cards.length, 714);
  assert.deepEqual(manifest.cards.map(card => card.id), CARD_DATABASE.map(card => card.id));
  assert.equal(manifest.layout.columns, 7);
  assert.equal(manifest.layout.rows, 7);
  assert.equal(manifest.sheets.length, 15);
  assert.equal(manifest.sheets[14].occupiedSlots, 28);
  assert.deepEqual(manifest.sheets[14].emptySlots, Array.from({ length: 21 }, (_, index) => index + 28));
  for (const sheet of manifest.sheets) {
    assert.equal(sheet.columns, 7);
    assert.equal(sheet.rows, 7);
    assert.equal(sheet.finalQualityApproved, false);
  }
});

test('starter ownership, crafting and boosters accept the complete collection', () => {
  const inventory = createDefaultInventory();
  for (const leaderId of ['goku', 'vegeta', 'gohan', 'frieza']) assert.equal(validateDeck(getStarterDeckForLeader(leaderId), inventory, leaderId).ok, true);
  for (const rarity of ['common', 'rare', 'super-rare']) {
    const card = NEXUS_CARDS.find(item => item.rarity === rarity);
    const result = craftCardState({ cardInventory: {}, dust: CRAFT_COST[rarity] }, card.id);
    assert.equal(result.ok, true);
    assert.equal(result.cardInventory[card.id], 1);
    assert.equal(result.dust, 0);
  }
  const rolled = rollPack(() => 0.999999);
  assert.ok(rolled.every(id => id.startsWith('nxs_') && getCardById(id)));
});

for (const [label, Engine] of [['server', ServerDuel], ['local', LocalDuel]]) {
  test(`${label}: every Nexus attack resolves and every technique applies its numbers`, () => {
    for (const card of NEXUS_CARDS.filter(card => card.type === 'attack' || card.type === 'tech')) {
      const engine = makeDuel(Engine);
      engine.player.hand = [instance(card)];
      const cost = getEffectiveCardCost(engine.player, card);
      const rule = getCardRule(card);
      try {
        assert.equal(engine._playCard('player', 0), true, card.id);
        assert.ok(engine.player.discard.includes(card.id), card.id);
        if (card.type === 'attack') {
          assert.equal(engine.state, 'ATTACK_PENDING', card.id);
          assert.equal(engine.pendingAttack.card.resolvedPower, card.power, card.id);
          engine.clearReactionTimer();
          engine.resolveUnansweredAttack();
          assert.ok(engine.opponent.hp < engine.opponent.maxHp, card.id);
        } else {
          assert.equal(engine.pendingAttack, null, card.id);
          assert.equal(engine.player.hp, Math.min(400, 300 - (rule.selfDamage || 0) + (rule.heal || 0)), card.id);
          assert.equal(engine.player.ki, Math.min(10, 10 - cost + (rule.kiGain || 0)), card.id);
          assert.equal(engine.player.nextAttackBonus, rule.nextAttackBonus || 0, card.id);
          assert.equal(engine.player.hand.length, rule.draw || 0, card.id);
        }
        assert.ok(engine.player.ki >= 0 && engine.player.ki <= 10, card.id);
      } finally { engine.reset(); }
    }
  });
  test(`${label}: every Nexus reaction is legal only in its supported window`, () => {
    for (const card of NEXUS_CARDS.filter(card => ['defense', 'evade', 'counter'].includes(card.type))) {
      const engine = makeDuel(Engine);
      const rule = getCardRule(card);
      const attack = getCardById(rule.physicalOnly ? 'atk_01' : 'atk_03');
      engine.state = 'ATTACK_PENDING';
      engine.initiative = 'player';
      engine.pendingAttack = { attackerKey: 'player', card: { ...instance(attack), resolvedPower: attack.power } };
      engine.opponent.hand = [instance(card)];
      const hpBefore = engine.player.hp;
      try {
        assert.equal(engine._playCard('opponent', 0), true, card.id);
        assert.ok(engine.opponent.discard.includes(card.id), card.id);
        assert.equal(engine.pendingAttack, null, card.id);
        if (card.type === 'counter') assert.equal(engine.player.hp, hpBefore - rule.counterDamage, card.id);
        if (card.type === 'evade') assert.equal(engine.opponent.hp, 400, card.id);
        if (rule.physicalOnly || rule.beamOnly) {
          const forbidden = getCardById(rule.physicalOnly ? 'atk_03' : 'atk_01');
          assert.equal(canUseReaction(engine.opponent, forbidden, card), false, card.id);
        }
        assert.ok(engine.opponent.hp >= 0 && engine.opponent.hp <= 400, card.id);
        assert.ok(engine.opponent.ki >= 0 && engine.opponent.ki <= 10, card.id);
      } finally { engine.reset(); }
    }
  });
}

console.log(`NEXUS COLLECTION TESTS: ${passed} PASS / 0 FAIL / 714 unique gameplay cards`);


