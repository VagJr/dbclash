/* ==========================================================================
   Dragon Ball Clash Action TCG - Deck Builder & Card Crafting Engine
   Per-character deck loading, saving, card crafting, and interactive UI
   ========================================================================== */

import { CARD_DATABASE, getCardById, getStarterDeckForLeader, LEADERS } from './card-database.js';
import { soundEngine } from './audio.js';
import { assetLoader } from './asset-loader.js';

function safeGetItem(key, fallback = null) {
  try {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(key) ?? fallback;
    }
  } catch (e) {}
  return fallback;
}

function safeSetItem(key, val) {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, val);
    }
  } catch (e) {}
}

export class DeckBuilder {
  constructor() {
    this.activeLeader = 'goku';
    this.zeni = parseInt(safeGetItem('dbtcg_zeni', '1500'), 10);
    this.dust = parseInt(safeGetItem('dbtcg_dust', '300'), 10);
  }

  getDeckForLeader(leaderId = this.activeLeader) {
    const saved = safeGetItem(`dbtcg_deck_${leaderId}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length >= 10) return parsed;
      } catch (e) {}
    }
    return getStarterDeckForLeader(leaderId);
  }

  saveDeckForLeader(leaderId, deckList) {
    safeSetItem(`dbtcg_deck_${leaderId}`, JSON.stringify(deckList));
    safeSetItem('dbtcg_zeni', this.zeni.toString());
    safeSetItem('dbtcg_dust', this.dust.toString());
  }

  saveDeck(deckList) {
    this.saveDeckForLeader(this.activeLeader, deckList || this.getDeckForLeader());
  }

  addCardToDeck(cardId, leaderId = this.activeLeader) {
    const currentDeck = this.getDeckForLeader(leaderId);
    if (currentDeck.length >= 20) {
      alert("Tamanho máximo do baralho é 20 cartas!");
      return false;
    }
    currentDeck.push(cardId);
    this.saveDeckForLeader(leaderId, currentDeck);
    soundEngine.playClick();
    this.render();
    return true;
  }

  removeCardFromDeck(index, leaderId = this.activeLeader) {
    const currentDeck = this.getDeckForLeader(leaderId);
    if (currentDeck.length <= 10) {
      alert("Tamanho mínimo do baralho é 10 cartas!");
      return false;
    }
    currentDeck.splice(index, 1);
    this.saveDeckForLeader(leaderId, currentDeck);
    soundEngine.playClick();
    this.render();
    return true;
  }

  resetDeckToDefault(leaderId = this.activeLeader) {
    const starter = getStarterDeckForLeader(leaderId);
    this.saveDeckForLeader(leaderId, starter);
    soundEngine.playClick();
    this.render();
  }

  craftCard(cardId) {
    const card = getCardById(cardId);
    const costMap = { 'common': 50, 'rare': 150, 'super-rare': 400 };
    const craftCost = costMap[card.rarity] || 100;

    if (this.dust < craftCost) {
      alert(`Poeira de Estrelas insuficiente! Necessário: ${craftCost} Poeiras.`);
      return false;
    }

    this.dust -= craftCost;
    this.addCardToDeck(cardId);
    soundEngine.playAwaken();
    return true;
  }

  render(containerId = 'deck-builder-container') {
    const container = document.getElementById(containerId);
    if (!container) return;

    const currentDeck = this.getDeckForLeader(this.activeLeader);

    container.innerHTML = `
      <div class="deck-builder-wrapper glass" style="padding:24px; max-width:1100px; margin:0 auto;">
        
        <!-- Header Controls -->
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:16px; margin-bottom:20px; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:14px;">
          <div>
            <h2 style="font-family:var(--font-title); font-weight:900; color:var(--ki-yellow); margin-bottom:4px;">🎴 Construtor de Decks</h2>
            <p style="font-size:0.82rem; color:var(--text-secondary);">Monte e personalize baralhos únicos para cada lutador (${currentDeck.length}/20 Cartas)</p>
          </div>

          <div style="display:flex; gap:10px;">
            <button id="reset-deck-btn" class="btn-ghost" style="font-size:0.78rem; padding:6px 12px;">↺ Restaurar Padrão</button>
          </div>
        </div>

        <!-- Leader Selector Bar -->
        <div style="display:flex; gap:10px; overflow-x:auto; padding-bottom:12px; margin-bottom:20px;">
          ${Object.values(LEADERS).map(l => `
            <button class="db-leader-tab ${this.activeLeader === l.id ? 'active' : ''}" data-leader="${l.id}" style="
              background:${this.activeLeader === l.id ? 'rgba(255,215,0,0.15)' : 'rgba(255,255,255,0.05)'};
              border:1px solid ${this.activeLeader === l.id ? 'var(--ki-yellow)' : 'rgba(255,255,255,0.1)'};
              color:${this.activeLeader === l.id ? 'var(--ki-yellow)' : '#fff'};
              padding:8px 16px; border-radius:10px; font-weight:800; cursor:pointer; display:flex; align-items:center; gap:6px; flex-shrink:0;
            ">
              <span>${l.icon}</span> ${l.name.split(' ')[0]}
            </button>
          `).join('')}
        </div>

        <!-- Deck List Slots -->
        <div style="margin-bottom:24px;">
          <h3 style="font-size:0.9rem; font-weight:900; color:#fff; margin-bottom:10px;">Baralho Ativo de ${LEADERS[this.activeLeader]?.name} (${currentDeck.length}/20)</h3>
          <div style="display:flex; flex-wrap:wrap; gap:8px; background:rgba(10,13,22,0.6); padding:14px; border-radius:12px; border:1px solid rgba(255,255,255,0.08); min-height:80px; align-items:center;">
            ${currentDeck.map((cardId, index) => {
              const card = getCardById(cardId);
              return `
                <div class="deck-chip type-${card.type}" style="
                  background:rgba(18,24,38,0.9); border:1px solid rgba(255,255,255,0.15); padding:4px 10px; border-radius:8px; font-size:0.75rem; font-weight:800; display:flex; align-items:center; gap:6px; color:#fff;
                ">
                  <span style="color:var(--ki-yellow);">${card.cost} Ki</span>
                  <span>${card.name}</span>
                  <button class="chip-remove-btn" data-index="${index}" style="background:none; border:none; color:#ff4444; font-weight:900; cursor:pointer; margin-left:4px;">✕</button>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <!-- Card Collection Grid -->
        <div>
          <h3 style="font-size:0.9rem; font-weight:900; color:#fff; margin-bottom:10px;">Coleção de Cartas Disponíveis (Clique para Adicionar)</h3>
          <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(130px, 1fr)); gap:12px;">
            ${CARD_DATABASE.map(card => `
              <div class="card collection-card type-${card.type}" data-card-id="${card.id}" style="cursor:pointer;">
                ${assetLoader.renderCardArtHTML(card)}
                <div class="card-header"><div class="card-ki-cost">${card.cost}</div></div>
                <div class="card-type-tag tag-${card.type}">${card.type.toUpperCase()}</div>
                ${card.power > 0 ? `<div class="card-power-badge">${card.power} ATK</div>` : ''}
              </div>
            `).join('')}
          </div>
        </div>

      </div>
    `;

    // Event Bindings
    container.querySelectorAll('.db-leader-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        this.activeLeader = tab.dataset.leader;
        soundEngine.playClick();
        this.render(containerId);
      });
    });

    container.querySelectorAll('.chip-remove-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.dataset.index, 10);
        this.removeCardFromDeck(idx);
      });
    });

    container.querySelectorAll('.collection-card').forEach(cardEl => {
      cardEl.addEventListener('click', () => {
        const cardId = cardEl.dataset.cardId;
        this.addCardToDeck(cardId);
      });
    });

    container.querySelector('#reset-deck-btn')?.addEventListener('click', () => {
      this.resetDeckToDefault(this.activeLeader);
    });
  }
}

export const deckBuilder = new DeckBuilder();
