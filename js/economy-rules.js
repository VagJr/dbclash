import { CARD_DATABASE, LEADERS, getStarterDeckForLeader, getCardById } from './card-database.js';

export const DECK_MIN = 10;
export const DECK_MAX = 20;
export const MAX_CARD_COPIES = 3;
export const PACK_COST = 300;
export const PACK_SIZE = 3;

export const CRAFT_COST = Object.freeze({
  common: 50,
  rare: 150,
  'super-rare': 400
});

export const OVERFLOW_DUST = Object.freeze({
  common: 15,
  rare: 40,
  'super-rare': 100
});

export const DEFAULT_UNLOCKED_LEADERS = Object.freeze(['goku', 'vegeta', 'gohan', 'frieza']);

export function normalizeInventory(raw = {}) {
  const out = {};
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    for (const [cardId, count] of Object.entries(raw)) {
      if (!getCardById(cardId)) continue;
      const n = Math.max(0, Math.min(MAX_CARD_COPIES, Math.floor(Number(count) || 0)));
      if (n > 0) out[cardId] = n;
    }
  }
  return out;
}

export function inventoryToOwnedCards(inventory = {}) {
  return Object.entries(normalizeInventory(inventory))
    .filter(([, count]) => count > 0)
    .map(([cardId]) => cardId);
}

export function addCardCopies(inventory, cardId, amount = 1, overflowToDust = true) {
  const card = getCardById(cardId);
  if (!card) return { inventory: normalizeInventory(inventory), added: 0, overflow: 0, dust: 0 };

  const next = normalizeInventory(inventory);
  const before = next[cardId] || 0;
  const requested = Math.max(0, Math.floor(Number(amount) || 0));
  const capacity = Math.max(0, MAX_CARD_COPIES - before);
  const added = Math.min(capacity, requested);
  const overflow = Math.max(0, requested - added);

  if (added > 0) next[cardId] = before + added;

  return {
    inventory: next,
    added,
    overflow,
    dust: overflowToDust ? overflow * (OVERFLOW_DUST[card.rarity] || 0) : 0
  };
}

export function createDefaultInventory(unlockedLeaders = DEFAULT_UNLOCKED_LEADERS) {
  let inventory = {};
  for (const leaderId of unlockedLeaders) {
    if (!LEADERS[leaderId]) continue;
    for (const cardId of getStarterDeckForLeader(leaderId)) {
      const result = addCardCopies(inventory, cardId, 1, false);
      inventory = result.inventory;
    }
  }
  return inventory;
}

export function migrateLegacyInventory(userLike = {}) {
  let inventory = normalizeInventory(userLike.cardInventory || {});

  if (Array.isArray(userLike.ownedCards)) {
    for (const cardId of userLike.ownedCards) {
      if (!getCardById(cardId)) continue;
      if (!inventory[cardId]) inventory[cardId] = 1;
    }
  }

  const leaders = Array.isArray(userLike.unlockedLeaders) && userLike.unlockedLeaders.length
    ? userLike.unlockedLeaders
    : DEFAULT_UNLOCKED_LEADERS;

  const starter = createDefaultInventory(leaders);
  for (const [cardId, count] of Object.entries(starter)) {
    inventory[cardId] = Math.max(inventory[cardId] || 0, count);
  }

  return normalizeInventory(inventory);
}

export function countCards(deck = []) {
  const counts = {};
  for (const id of deck) counts[id] = (counts[id] || 0) + 1;
  return counts;
}

export function validateDeck(deck, inventory, leaderId, unlockedLeaders = DEFAULT_UNLOCKED_LEADERS) {
  if (!LEADERS[leaderId]) return { ok: false, code: 'INVALID_LEADER', message: 'Lutador invalido.' };
  if (!unlockedLeaders.includes(leaderId)) return { ok: false, code: 'LEADER_LOCKED', message: 'Lutador bloqueado.' };
  if (!Array.isArray(deck)) return { ok: false, code: 'INVALID_DECK', message: 'Deck invalido.' };
  if (deck.length < DECK_MIN || deck.length > DECK_MAX) {
    return { ok: false, code: 'DECK_SIZE', message: `O deck deve ter entre ${DECK_MIN} e ${DECK_MAX} cartas.` };
  }

  const safeInventory = normalizeInventory(inventory);
  const counts = countCards(deck);

  for (const [cardId, count] of Object.entries(counts)) {
    if (!getCardById(cardId)) return { ok: false, code: 'UNKNOWN_CARD', message: `Carta invalida: ${cardId}` };
    if (count > MAX_CARD_COPIES) {
      return { ok: false, code: 'COPY_LIMIT', message: `Maximo de ${MAX_CARD_COPIES} copias de ${cardId}.` };
    }
    if ((safeInventory[cardId] || 0) < count) {
      return { ok: false, code: 'NOT_OWNED', message: `Voce nao possui copias suficientes de ${cardId}.` };
    }
  }

  return { ok: true, code: 'OK', deck: [...deck] };
}

export function getCraftCost(cardId) {
  const card = getCardById(cardId);
  return card ? (CRAFT_COST[card.rarity] || null) : null;
}

export function craftCardState(profile, cardId) {
  const card = getCardById(cardId);
  if (!card) return { ok: false, code: 'UNKNOWN_CARD' };

  const inventory = normalizeInventory(profile.cardInventory);
  if ((inventory[cardId] || 0) >= MAX_CARD_COPIES) {
    return { ok: false, code: 'COPY_LIMIT' };
  }

  const cost = getCraftCost(cardId);
  const dust = Math.max(0, Number(profile.dust) || 0);
  if (dust < cost) return { ok: false, code: 'NOT_ENOUGH_DUST', cost };

  const result = addCardCopies(inventory, cardId, 1, false);
  return {
    ok: true,
    cardId,
    cost,
    dust: dust - cost,
    cardInventory: result.inventory,
    ownedCards: inventoryToOwnedCards(result.inventory)
  };
}

export function unlockLeaderState(profile, leaderId) {
  const leader = LEADERS[leaderId];
  if (!leader) return { ok: false, code: 'INVALID_LEADER' };

  const current = Array.isArray(profile.unlockedLeaders) ? [...new Set(profile.unlockedLeaders)] : [...DEFAULT_UNLOCKED_LEADERS];
  if (current.includes(leaderId)) {
    return {
      ok: true,
      alreadyUnlocked: true,
      unlockedLeaders: current,
      zeni: Math.max(0, Number(profile.zeni) || 0),
      cardInventory: normalizeInventory(profile.cardInventory),
      ownedCards: inventoryToOwnedCards(profile.cardInventory)
    };
  }

  const cost = Math.max(0, Number(leader.unlockCost) || 0);
  const zeni = Math.max(0, Number(profile.zeni) || 0);
  if (zeni < cost) return { ok: false, code: 'NOT_ENOUGH_ZENI', cost };

  current.push(leaderId);
  let inventory = normalizeInventory(profile.cardInventory);
  for (const cardId of getStarterDeckForLeader(leaderId)) {
    inventory = addCardCopies(inventory, cardId, 1, false).inventory;
  }

  return {
    ok: true,
    alreadyUnlocked: false,
    cost,
    unlockedLeaders: current,
    zeni: zeni - cost,
    cardInventory: inventory,
    ownedCards: inventoryToOwnedCards(inventory)
  };
}

export function rollPack(randomFloat = Math.random) {
  const byRarity = {
    common: CARD_DATABASE.filter(c => c.rarity === 'common'),
    rare: CARD_DATABASE.filter(c => c.rarity === 'rare'),
    'super-rare': CARD_DATABASE.filter(c => c.rarity === 'super-rare')
  };

  const cards = [];
  for (let i = 0; i < PACK_SIZE; i++) {
    const roll = Number(randomFloat());
    const rarity = roll > 0.85 ? 'super-rare' : roll > 0.50 ? 'rare' : 'common';
    const pool = byRarity[rarity];
    const pick = Math.min(pool.length - 1, Math.max(0, Math.floor(Number(randomFloat()) * pool.length)));
    cards.push(pool[pick].id);
  }
  return cards;
}

export function openPackState(profile, cardIds) {
  const zeni = Math.max(0, Number(profile.zeni) || 0);
  if (zeni < PACK_COST) return { ok: false, code: 'NOT_ENOUGH_ZENI', cost: PACK_COST };
  if (!Array.isArray(cardIds) || cardIds.length !== PACK_SIZE || cardIds.some(id => !getCardById(id))) {
    return { ok: false, code: 'INVALID_PACK' };
  }

  let inventory = normalizeInventory(profile.cardInventory);
  let dust = Math.max(0, Number(profile.dust) || 0);
  const results = [];

  for (const cardId of cardIds) {
    const result = addCardCopies(inventory, cardId, 1, true);
    inventory = result.inventory;
    dust += result.dust;
    results.push({
      cardId,
      added: result.added,
      overflow: result.overflow,
      dustGained: result.dust
    });
  }

  return {
    ok: true,
    zeni: zeni - PACK_COST,
    dust,
    cardInventory: inventory,
    ownedCards: inventoryToOwnedCards(inventory),
    results
  };
}

export function publicEconomySnapshot(userLike = {}) {
  const cardInventory = migrateLegacyInventory(userLike);
  return {
    zeni: Math.max(0, Number(userLike.zeni) || 0),
    gems: Math.max(0, Number(userLike.gems) || 0),
    dust: Math.max(0, Number(userLike.dust) || 0),
    cardInventory,
    ownedCards: inventoryToOwnedCards(cardInventory)
  };
}
