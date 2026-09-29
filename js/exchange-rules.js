import { getCardById } from './card-database.js';
import { MAX_CARD_COPIES, normalizeInventory, inventoryToOwnedCards, createDefaultInventory, DEFAULT_UNLOCKED_LEADERS, totalCardCopies } from './economy-rules.js';

export const MAX_LISTING_PRICE = 100000;
export const EXCHANGE_TTL_MS = 7 * 86400000;

export class ExchangeError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

function assert(condition, code, message) {
  if (!condition) throw new ExchangeError(code, message);
}

export function cardReservedByDeck(profile, cardId) {
  // Legacy profile migration restores starter entitlements. Those copies must
  // never enter escrow, otherwise a refresh could recreate a traded card.
  const leaders = Array.isArray(profile.unlockedLeaders) && profile.unlockedLeaders.length
    ? profile.unlockedLeaders : DEFAULT_UNLOCKED_LEADERS;
  const reserved = normalizeInventory(profile.escrowInventory)[cardId] || 0;
  const starterFloor = Math.min(createDefaultInventory(leaders)[cardId] || 0, MAX_CARD_COPIES - reserved);
  return Math.max(starterFloor, 0, ...Object.values(profile.customDecks || {})
    .filter(Array.isArray).map(deck => deck.filter(id => id === cardId).length));
}

export function transferableCopies(profile, cardId) {
  return Math.max(0, (normalizeInventory(profile.cardInventory)[cardId] || 0) - cardReservedByDeck(profile, cardId));
}

function withInventory(profile, inventory, zeni = profile.zeni, escrow = profile.escrowInventory) {
  return { ...profile, zeni, cardInventory: inventory, escrowInventory: normalizeInventory(escrow), ownedCards: inventoryToOwnedCards(inventory) };
}

export function reserveExchange(profile, { kind, cardId, requestedCardId, price }) {
  assert(!profile.isGuest && profile.uid, 'ACCOUNT_REQUIRED', 'Entre em uma conta para negociar.');
  assert(kind === 'sale' || kind === 'trade', 'INVALID_KIND', 'Tipo de negociação inválido.');
  assert(getCardById(cardId), 'UNKNOWN_CARD', 'Carta inválida.');
  assert(transferableCopies(profile, cardId) > 0, 'CARD_RESERVED', 'Esta cópia está em um deck ou não está disponível.');
  if (kind === 'sale') {
    assert(Number.isSafeInteger(price) && price >= 1 && price <= MAX_LISTING_PRICE,
      'INVALID_PRICE', `Use um preço inteiro entre 1 e ${MAX_LISTING_PRICE} Zeni.`);
  } else {
    assert(getCardById(requestedCardId) && requestedCardId !== cardId, 'INVALID_TRADE', 'Escolha uma carta diferente para a troca.');
  }
  const inventory = normalizeInventory(profile.cardInventory);
  const escrow = normalizeInventory(profile.escrowInventory);
  inventory[cardId] -= 1;
  if (!inventory[cardId]) delete inventory[cardId];
  escrow[cardId] = (escrow[cardId] || 0) + 1;
  assert(escrow[cardId] <= MAX_CARD_COPIES, 'COPY_LIMIT', 'Limite de cópias reservadas excedido.');
  return withInventory(profile, inventory, profile.zeni, escrow);
}

export function settleExchange(listing, seller, buyer, now = Date.now()) {
  assert(listing.status === 'open', 'LISTING_CLOSED', 'Essa oferta já foi concluída.');
  assert(Number(new Date(listing.expiresAt)) > now, 'LISTING_EXPIRED', 'Oferta expirada. O anunciante pode recuperar a carta.');
  assert(seller.uid === listing.sellerUid && seller.uid !== buyer.uid, 'INVALID_PARTICIPANT', 'Participantes inválidos.');
  assert(!buyer.isGuest && buyer.uid, 'ACCOUNT_REQUIRED', 'Entre em uma conta para negociar.');
  const sellerInventory = normalizeInventory(seller.cardInventory);
  const buyerInventory = normalizeInventory(buyer.cardInventory);
  assert(totalCardCopies(buyer, listing.cardId) < MAX_CARD_COPIES, 'COPY_LIMIT', 'Você já possui o máximo de cópias desta carta, incluindo reservas.');
  let sellerZeni = Math.max(0, Number(seller.zeni) || 0);
  let buyerZeni = Math.max(0, Number(buyer.zeni) || 0);
  if (listing.kind === 'sale') {
    assert(Number.isSafeInteger(listing.price) && listing.price >= 1 && listing.price <= MAX_LISTING_PRICE, 'INVALID_PRICE', 'Preço inválido.');
    assert(buyerZeni >= listing.price, 'NOT_ENOUGH_ZENI', 'Zeni insuficiente.');
    assert(Number.isSafeInteger(sellerZeni + listing.price), 'BALANCE_LIMIT', 'Limite de saldo excedido.');
    sellerZeni += listing.price;
    buyerZeni -= listing.price;
  } else {
    assert(listing.kind === 'trade' && getCardById(listing.requestedCardId), 'INVALID_TRADE', 'Troca inválida.');
    assert(transferableCopies(buyer, listing.requestedCardId) > 0, 'CARD_RESERVED', 'A carta solicitada está reservada em um deck.');
    assert(totalCardCopies(seller, listing.requestedCardId) < MAX_CARD_COPIES, 'SELLER_COPY_LIMIT', 'O anunciante já atingiu o limite da carta solicitada.');
    buyerInventory[listing.requestedCardId] -= 1;
    if (!buyerInventory[listing.requestedCardId]) delete buyerInventory[listing.requestedCardId];
    sellerInventory[listing.requestedCardId] = (sellerInventory[listing.requestedCardId] || 0) + 1;
  }
  buyerInventory[listing.cardId] = (buyerInventory[listing.cardId] || 0) + 1;
  const escrow = normalizeInventory(seller.escrowInventory);
  assert((escrow[listing.cardId] || 0) >= 1, 'ESCROW_MISSING', 'A carta reservada não foi encontrada.');
  escrow[listing.cardId] -= 1;
  if (!escrow[listing.cardId]) delete escrow[listing.cardId];
  return { seller: withInventory(seller, sellerInventory, sellerZeni, escrow), buyer: withInventory(buyer, buyerInventory, buyerZeni) };
}

export function cancelExchange(listing, seller) {
  assert(listing.status === 'open' && listing.sellerUid === seller.uid, 'LISTING_CLOSED', 'Oferta indisponível.');
  const inventory = normalizeInventory(seller.cardInventory);
  const escrow = normalizeInventory(seller.escrowInventory);
  assert((escrow[listing.cardId] || 0) >= 1, 'ESCROW_MISSING', 'A carta reservada não foi encontrada.');
  assert((inventory[listing.cardId] || 0) < MAX_CARD_COPIES, 'COPY_LIMIT', 'Libere uma cópia antes de recuperar a carta reservada.');
  inventory[listing.cardId] = (inventory[listing.cardId] || 0) + 1;
  escrow[listing.cardId] -= 1;
  if (!escrow[listing.cardId]) delete escrow[listing.cardId];
  return withInventory(seller, inventory, seller.zeni, escrow);
}
