/* ==========================================================================
   Dragon Ball Clash Action TCG - Pack Opener System
   ========================================================================== */

import { CARD_DATABASE } from './card-database.js';
import { deckBuilder } from './deck-builder.js';
import { soundEngine } from './audio.js';

import { authManager } from './auth-manager.js';

export class PackOpener {
  constructor() {
    this.packCost = 300; // 300 Zeni per pack
  }

  openPack() {
    if (deckBuilder.zeni < this.packCost) {
      alert(`Zeni insuficiente! Você precisa de ${this.packCost} Zeni para abrir um booster.`);
      return null;
    }

    deckBuilder.zeni -= this.packCost;
    if (typeof deckBuilder.saveDeck === 'function') {
      deckBuilder.saveDeck();
    } else if (typeof deckBuilder.saveDeckForLeader === 'function') {
      deckBuilder.saveDeckForLeader(deckBuilder.activeLeader || 'goku', deckBuilder.getDeckForLeader ? deckBuilder.getDeckForLeader() : []);
    }

    soundEngine.playKiCharge();

    // Generate 3 random cards with rarity weightings
    const pulledCards = [];
    for (let i = 0; i < 3; i++) {
      const rand = Math.random();
      let pool = CARD_DATABASE.filter(c => c.rarity === 'common');
      if (rand > 0.85) {
        pool = CARD_DATABASE.filter(c => c.rarity === 'super-rare');
      } else if (rand > 0.50) {
        pool = CARD_DATABASE.filter(c => c.rarity === 'rare');
      }
      
      const card = pool[Math.floor(Math.random() * pool.length)];
      pulledCards.push(card);
      deckBuilder.addCardToDeck(card.id);
      authManager.addCardToInventory(card.id);
    }

    soundEngine.playAwaken();
    return pulledCards;
  }
}

export const packOpener = new PackOpener();
