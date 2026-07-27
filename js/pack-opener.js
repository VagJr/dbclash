/* ==========================================================================
   Dragon Ball Clash Action TCG - Pack Opener System
   ========================================================================== */

import { CARD_DATABASE } from './card-database.js';
import { deckBuilder } from './deck-builder.js';
import { soundEngine } from './audio.js';

export class PackOpener {
  constructor() {
    this.packCost = 300; // 300 Zeni per pack
  }

  openPack() {
    if (deckBuilder.zeni < this.packCost) {
      alert(`Not enough Zeni! You need ${this.packCost} Zeni to open a pack.`);
      return null;
    }

    deckBuilder.zeni -= this.packCost;
<<<<<<< HEAD
    if (typeof deckBuilder.saveDeck === 'function') {
      deckBuilder.saveDeck();
    } else if (typeof deckBuilder.saveDeckForLeader === 'function') {
      deckBuilder.saveDeckForLeader(deckBuilder.activeLeader || 'goku', deckBuilder.getDeckForLeader ? deckBuilder.getDeckForLeader() : []);
    }
=======
    deckBuilder.saveDeck(deckBuilder.currentDeck);
>>>>>>> 75cdb2b5faac518831c31cadd3baa480b065f443

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
      deckBuilder.addCardToDeck(card.id); // Add to player collection deck
    }

    soundEngine.playAwaken();
    return pulledCards;
  }
}

export const packOpener = new PackOpener();
