/* ==========================================================================
   Dragon Ball Clash Action TCG - Professional Deck Builder Module
   Supports custom decks per leader, max card limit validation, card counts,
   and 1-click batch injection of 4K custom compiled cards into active play.
   ========================================================================== */

import { CARD_DATABASE, getCardById, LEADERS } from './card-database.js';
import { soundEngine } from './audio.js';
import { cardStudioEngine } from './card-builder-engine.js';

export class DeckBuilder {
  constructor() {
    this.activeLeader = 'goku';
    this.decks = this.loadDecks();
  }

  loadDecks() {
    try {
      const saved = localStorage.getItem('dbtcg_decks');
      if (saved) return JSON.parse(saved);
    } catch (e) {}

    // Initial Default Decks for each Leader
    return {
      goku: ['atk_01', 'atk_01', 'atk_02', 'atk_03', 'atk_04', 'atk_05', 'atk_06', 'def_01', 'def_02', 'def_03', 'evd_01', 'evd_02', 'tch_01', 'tch_02', 'ctr_01', 'ctr_02', 'atk_07', 'atk_08', 'def_04', 'tch_03'],
      vegeta: ['atk_07', 'atk_07', 'atk_08', 'atk_09', 'atk_10', 'atk_11', 'def_04', 'def_05', 'def_06', 'evd_03', 'evd_04', 'tch_04', 'tch_05', 'ctr_03', 'ctr_04', 'atk_12', 'atk_13', 'def_07', 'tch_06'],
      gohan: ['atk_13', 'atk_13', 'atk_14', 'atk_15', 'atk_16', 'def_07', 'def_08', 'def_09', 'evd_05', 'evd_06', 'tch_07', 'tch_08', 'ctr_05', 'ctr_06', 'atk_17', 'atk_18', 'def_10', 'tch_09'],
      piccolo: ['atk_05', 'atk_05', 'def_03', 'def_03', 'def_10', 'def_11', 'def_12', 'tch_01', 'tch_02', 'tch_03', 'ctr_07', 'ctr_08', 'evd_07', 'evd_08', 'atk_19', 'atk_20', 'def_13', 'tch_04'],
      trunks: ['atk_21', 'atk_21', 'atk_22', 'atk_23', 'def_12', 'def_13', 'def_14', 'evd_08', 'evd_09', 'tch_05', 'tch_06', 'ctr_08', 'ctr_09', 'atk_24', 'atk_25', 'def_15', 'tch_07'],
      frieza: ['atk_26', 'atk_26', 'atk_27', 'atk_28', 'def_15', 'def_15', 'tch_08', 'tch_09', 'ctr_09', 'ctr_09', 'evd_01', 'evd_02', 'atk_01', 'atk_02', 'def_01', 'def_02', 'tch_01', 'ctr_01']
    };
  }

  saveDecks() {
    try {
      localStorage.setItem('dbtcg_decks', JSON.stringify(this.decks));
    } catch (e) {}
  }

  getActiveDeck() {
    return this.decks[this.activeLeader] || [];
  }

  getDeckForLeader(leaderId) {
    if (!leaderId) return this.getActiveDeck();
    const key = leaderId.toLowerCase();
    return this.decks[key] || this.getActiveDeck();
  }

  addCardToDeck(cardId) {
    const deck = this.getActiveDeck();
    if (deck.length >= 20) {
      if (typeof window !== 'undefined' && window.uiManager) window.uiManager.showToast('Limite de 20 cartas no baralho atingido!', '⚠️');
      soundEngine.playError();
      return;
    }

    const count = deck.filter(id => id === cardId).length;
    if (count >= 3) {
      if (typeof window !== 'undefined' && window.uiManager) window.uiManager.showToast('Máximo de 3 cópias da mesma carta por deck!', '⚠️');
      soundEngine.playError();
      return;
    }

    deck.push(cardId);
    this.saveDecks();
    soundEngine.playClick();
    this.render();
  }

  removeCardFromDeck(index) {
    const deck = this.getActiveDeck();
    if (index >= 0 && index < deck.length) {
      deck.splice(index, 1);
      this.saveDecks();
      soundEngine.playClick();
      this.render();
    }
  }

  resetDeckToDefault(leaderId) {
    const defaults = this.loadDecks();
    this.decks[leaderId] = defaults[leaderId] || [];
    this.saveDecks();
    soundEngine.playAwaken();
    this.render();
    if (typeof window !== 'undefined' && window.uiManager) window.uiManager.showToast(`Deck do guerreiro restaurado para o padrão!`, '↺');
  }

  render() {
    const container = document.getElementById('deck-builder-container');
    if (!container) return;

    const currentDeck = this.getActiveDeck();

    // Group current deck cards for counter visualization
    const counts = {};
    currentDeck.forEach(id => {
      counts[id] = (counts[id] || 0) + 1;
    });

    container.innerHTML = `
      <div class="deck-builder-wrapper glass" style="padding:24px; max-width:1100px; margin:0 auto;">
        
        <!-- Header Controls -->
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:16px; margin-bottom:20px; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:14px;">
          <div>
            <h2 style="font-family:var(--font-title); font-weight:900; color:var(--ki-yellow); margin-bottom:4px;">🎴 Construtor de Decks</h2>
            <p style="font-size:0.82rem; color:var(--text-secondary);">Monte e personalize baralhos únicos para cada lutador (${currentDeck.length}/20 Cartas)</p>
          </div>

          <div style="display:flex; gap:10px; flex-wrap:wrap;">
            <button id="batch-inject-all-game-btn" class="btn-primary" style="font-size:0.78rem; padding:6px 14px; background:linear-gradient(135deg,#10b981,#059669); border:1px solid #34d399; font-weight:900; box-shadow:0 0 12px rgba(16,185,129,0.4);">
              🚀 INJETAR TODAS AS CARTAS NO JOGO
            </button>
            <button id="open-studio-btn" class="btn-primary" style="font-size:0.78rem; padding:6px 14px; background:linear-gradient(135deg,#f59e0b,#d97706); border:1px solid #ffd700; font-weight:900;">
              🎨 Abrir Estúdio Maker de Cartas
            </button>
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
        <div style="background:rgba(8,12,24,0.6); padding:16px; border-radius:12px; border:1px solid rgba(255,255,255,0.08); margin-bottom:24px;">
          <h3 style="font-size:0.85rem; font-weight:900; color:#cbd5e1; margin-bottom:12px; text-transform:uppercase; letter-spacing:1px;">
            Cartas no Baralho do Lutador (${currentDeck.length}/20):
          </h3>

          ${currentDeck.length === 0 ? `
            <div style="text-align:center; padding:30px; color:#64748b; font-size:0.85rem;">Seu baralho está vazio. Clique nas cartas da coleção abaixo para adicionar!</div>
          ` : `
            <div style="display:flex; flex-wrap:wrap; gap:8px;">
              ${currentDeck.map((cardId, idx) => {
                const card = getCardById(cardId);
                if (!card) return '';
                return `
                  <div class="deck-card-chip" style="display:flex; align-items:center; gap:6px; background:rgba(255,255,255,0.08); border:1px solid rgba(255,215,0,0.3); padding:4px 10px; border-radius:20px; font-size:0.75rem; color:#fff; font-weight:700;">
                    <span>${card.name} (${card.cost} Ki)</span>
                    <button class="chip-remove-btn" data-index="${idx}" style="background:none; border:none; color:#ff4444; cursor:pointer; font-weight:900; padding:0 2px;">✕</button>
                  </div>
                `;
              }).join('')}
            </div>
          `}
        </div>

        <!-- Collection Selector Grid -->
        <div>
          <h3 style="font-size:0.85rem; font-weight:900; color:#cbd5e1; margin-bottom:12px; text-transform:uppercase; letter-spacing:1px;">
            Coleção Completa de Tecnologias & Golpes (Clique para adicionar ao baralho):
          </h3>
          <div class="deck-collection-grid" style="display:grid; grid-template-columns:repeat(auto-fill, minmax(130px, 1fr)); gap:12px; max-height:480px; overflow-y:auto; padding-right:6px;">
          </div>
        </div>

      </div>
    `;

    // Progressive rendering: Load initial 16 visible cards instantly, then render remaining cards on next frame
    const gridEl = container.querySelector('.deck-collection-grid');
    if (gridEl) {
      const renderCardItem = (card) => {
        const inDeckCount = counts[card.id] || 0;
        return `
          <div class="collection-card" data-card-id="${card.id}" style="position:relative; cursor:pointer; border-radius:8px; overflow:hidden; border:2px solid ${inDeckCount > 0 ? '#ffd700' : 'rgba(255,255,255,0.1)'}; transition:all 0.2s ease;">
            <div class="card-wrapper-inner" style="width:100%; aspect-ratio:7/10;">
              ${assetLoader.renderCardHTML(card)}
            </div>
            ${inDeckCount > 0 ? `<div style="position:absolute; top:4px; right:4px; background:#ffd700; color:#000; font-weight:900; font-size:0.7rem; border-radius:50%; width:20px; height:20px; display:flex; align-items:center; justify-content:center; box-shadow:0 2px 6px rgba(0,0,0,0.8); z-index:20;">x${inDeckCount}</div>` : ''}
          </div>
        `;
      };

      const initialChunk = CARD_DATABASE.slice(0, 16).map(renderCardItem).join('');
      gridEl.innerHTML = initialChunk;

      requestAnimationFrame(() => {
        const remainingChunk = CARD_DATABASE.slice(16).map(renderCardItem).join('');
        gridEl.insertAdjacentHTML('beforeend', remainingChunk);
        
        // Bind events on dynamically added cards
        gridEl.querySelectorAll('.collection-card').forEach(cardEl => {
          cardEl.addEventListener('click', () => {
            const cardId = cardEl.dataset.cardId;
            this.addCardToDeck(cardId);
          });
        });
      });
    }

    this.bindEvents(container);
  }

  bindEvents(container) {
    container.querySelectorAll('.db-leader-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        this.activeLeader = tab.dataset.leader;
        soundEngine.playClick();
        this.render();
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

    const openStudioBtn = document.getElementById('open-studio-btn');
    if (openStudioBtn) {
      openStudioBtn.addEventListener('click', () => {
        cardStudioEngine.openStudio();
      });
    }

    const batchInjectBtn = document.getElementById('batch-inject-all-game-btn');
    if (batchInjectBtn) {
      batchInjectBtn.addEventListener('click', () => {
        cardStudioEngine.batchInjectAllCards();
      });
    }

    const resetBtn = document.getElementById('reset-deck-btn');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        if (confirm('Restaurar o baralho padrão para este guerreiro?')) {
          this.resetDeckToDefault(this.activeLeader);
        }
      });
    }
  }
}

export const deckBuilder = new DeckBuilder();
