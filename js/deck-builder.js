/* ==========================================================================
   Dragon Ball Clash Action TCG - Account-scoped Deck Builder
   ========================================================================== */

import { CARD_DATABASE, getCardById, getStarterDeckForLeader, LEADERS } from './card-database.js';
import { soundEngine } from './audio.js';
import { assetLoader } from './asset-loader.js';
import { authManager } from './auth-manager.js';
import { DECK_MIN, DECK_MAX, MAX_CARD_COPIES, getCraftCost, validateDeck } from './economy-rules.js';

export class DeckBuilder {
  constructor() {
    this.activeLeader = 'goku';
  }

  get zeni() { return authManager.user?.zeni || 0; }
  set zeni(_) {}
  get dust() { return authManager.user?.dust || 0; }
  set dust(_) {}

  getDeckForLeader(leaderId = this.activeLeader) {
    return authManager.getDeckForLeader(leaderId);
  }

  async saveDeckForLeader(leaderId, deckList) {
    return await authManager.saveDeck(leaderId, deckList);
  }

  async saveDeck(deckList) {
    return await this.saveDeckForLeader(this.activeLeader, deckList || this.getDeckForLeader());
  }

  getOwnedCount(cardId) {
    return authManager.getCardCount(cardId);
  }

  getDeckCount(cardId, leaderId = this.activeLeader) {
    return this.getDeckForLeader(leaderId).filter(id => id === cardId).length;
  }

  async addCardToDeck(cardId, leaderId = this.activeLeader) {
    const card = getCardById(cardId);
    if (!card) return false;

    const currentDeck = [...this.getDeckForLeader(leaderId)];
    if (currentDeck.length >= DECK_MAX) {
      alert(`Tamanho maximo do baralho e ${DECK_MAX} cartas!`);
      return false;
    }

    const inDeck = currentDeck.filter(id => id === cardId).length;
    const owned = this.getOwnedCount(cardId);
    if (inDeck >= MAX_CARD_COPIES || inDeck >= owned) {
      alert(`Voce nao possui outra copia disponivel de ${card.name}.`);
      return false;
    }

    currentDeck.push(cardId);
    const result = await this.saveDeckForLeader(leaderId, currentDeck);
    if (!result.success) {
      alert(result.message || 'Nao foi possivel salvar o deck.');
      return false;
    }

    soundEngine.playClick();
    this.render();
    return true;
  }

  async removeCardFromDeck(index, leaderId = this.activeLeader) {
    const currentDeck = [...this.getDeckForLeader(leaderId)];
    if (currentDeck.length <= DECK_MIN) {
      alert(`Tamanho minimo do baralho e ${DECK_MIN} cartas!`);
      return false;
    }
    if (index < 0 || index >= currentDeck.length) return false;

    currentDeck.splice(index, 1);
    const result = await this.saveDeckForLeader(leaderId, currentDeck);
    if (!result.success) {
      alert(result.message || 'Nao foi possivel salvar o deck.');
      return false;
    }

    soundEngine.playClick();
    this.render();
    return true;
  }

  async resetDeckToDefault(leaderId = this.activeLeader) {
    const starter = getStarterDeckForLeader(leaderId);
    const validation = validateDeck(
      starter,
      authManager.user?.cardInventory,
      leaderId,
      authManager.user?.unlockedLeaders || []
    );
    if (!validation.ok) {
      alert(validation.message || 'Deck inicial indisponivel para esta conta.');
      return false;
    }

    const result = await this.saveDeckForLeader(leaderId, starter);
    if (!result.success) return false;
    soundEngine.playClick();
    this.render();
    return true;
  }

  async craftCard(cardId) {
    const card = getCardById(cardId);
    if (!card) return false;

    const result = await authManager.craftCard(cardId);
    if (!result.success) {
      const cost = getCraftCost(cardId);
      if (result.code === 'COPY_LIMIT') alert(`Limite de ${MAX_CARD_COPIES} copias atingido.`);
      else if (result.code === 'NOT_ENOUGH_DUST') alert(`Dust insuficiente. Necessario: ${cost}.`);
      else alert(result.message || 'Nao foi possivel criar a carta.');
      return false;
    }

    soundEngine.playAwaken();
    this.render();
    return true;
  }

  render(containerId = 'deck-builder-container') {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (!authManager.user?.unlockedLeaders?.includes(this.activeLeader)) {
      this.activeLeader = authManager.user?.selectedLeader || 'goku';
    }

    const currentDeck = this.getDeckForLeader(this.activeLeader);
    const unlocked = new Set(authManager.user?.unlockedLeaders || []);

    container.innerHTML = `
      <div class="deck-builder-wrapper glass" style="padding:24px; max-width:1100px; margin:0 auto;">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:16px; margin-bottom:20px; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:14px;">
          <div>
            <h2 style="font-family:var(--font-title); font-weight:900; color:var(--ki-yellow); margin-bottom:4px;">Construtor de Decks</h2>
            <p style="font-size:0.82rem; color:var(--text-secondary);">
              ${currentDeck.length}/${DECK_MAX} cartas | ${DECK_MIN}-${DECK_MAX} por deck | max. ${MAX_CARD_COPIES} copias
            </p>
          </div>
          <div style="display:flex; gap:10px;">
            <span style="font-weight:800;">${this.dust} Dust</span>
            <button id="reset-deck-btn" class="btn-ghost" style="font-size:0.78rem; padding:6px 12px;">Restaurar Padrao</button>
          </div>
        </div>

        <div style="display:flex; gap:10px; overflow-x:auto; padding-bottom:12px; margin-bottom:20px;">
          ${Object.values(LEADERS).filter(l => unlocked.has(l.id)).map(l => `
            <button class="db-leader-tab ${this.activeLeader === l.id ? 'active' : ''}" data-leader="${l.id}">
              <span>${l.icon}</span> ${l.name.split(' ')[0]}
            </button>
          `).join('')}
        </div>

        <div style="margin-bottom:24px;">
          <h3>Baralho Ativo (${currentDeck.length}/${DECK_MAX})</h3>
          <div style="display:flex; flex-wrap:wrap; gap:8px; min-height:80px;">
            ${currentDeck.map((cardId, index) => {
              const card = getCardById(cardId);
              if (!card) return '';
              return `
                <div class="deck-chip type-${card.type}">
                  <span>${card.cost} Ki</span>
                  <span>${card.name}</span>
                  <button class="chip-remove-btn" data-index="${index}">x</button>
                </div>`;
            }).join('')}
          </div>
        </div>

        <div>
          <h3>Colecao</h3>
          <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(130px, 1fr)); gap:12px;">
            ${CARD_DATABASE.map(card => {
              const owned = this.getOwnedCount(card.id);
              const used = this.getDeckCount(card.id);
              const canAdd = owned > used && used < MAX_CARD_COPIES && currentDeck.length < DECK_MAX;
              return `
                <div class="card collection-card type-${card.type} ${owned ? '' : 'unowned'}" data-card-id="${card.id}">
                  ${assetLoader.renderCardArtHTML(card)}
                  <div class="card-header"><div class="card-ki-cost">${card.cost}</div></div>
                  <div class="card-type-tag tag-${card.type}">${card.type.toUpperCase()}</div>
                  <div style="font-size:.68rem;font-weight:900;">Possui ${owned}/${MAX_CARD_COPIES} | Deck ${used}</div>
                  ${canAdd
                    ? `<button class="collection-add-btn" data-card-id="${card.id}">ADICIONAR</button>`
                    : owned < MAX_CARD_COPIES
                      ? `<button class="collection-craft-btn" data-card-id="${card.id}">CRIAR ${getCraftCost(card.id)} Dust</button>`
                      : ''}
                </div>`;
            }).join('')}
          </div>
        </div>
      </div>`;

    container.querySelectorAll('.db-leader-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        this.activeLeader = tab.dataset.leader;
        soundEngine.playClick();
        this.render(containerId);
      });
    });

    container.querySelectorAll('.chip-remove-btn').forEach(btn => {
      btn.addEventListener('click', async e => {
        e.stopPropagation();
        await this.removeCardFromDeck(Number(btn.dataset.index));
      });
    });

    container.querySelectorAll('.collection-add-btn').forEach(btn => {
      btn.addEventListener('click', async e => {
        e.stopPropagation();
        await this.addCardToDeck(btn.dataset.cardId);
      });
    });

    container.querySelectorAll('.collection-craft-btn').forEach(btn => {
      btn.addEventListener('click', async e => {
        e.stopPropagation();
        await this.craftCard(btn.dataset.cardId);
      });
    });

    container.querySelector('#reset-deck-btn')?.addEventListener('click', async () => {
      await this.resetDeckToDefault(this.activeLeader);
    });
  }
}

export const deckBuilder = new DeckBuilder();
