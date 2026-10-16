/* ==========================================================================
   Dragon Ball Clash Action TCG - Pack Opener System (with Holographic Foils)
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
    const currentZeni = authManager.user?.zeni !== undefined && !isNaN(authManager.user.zeni) 
      ? authManager.user.zeni 
      : (deckBuilder.zeni || 1500);

    const ui = window.uiManager;

    if (currentZeni < this.packCost) {
      if (ui && typeof ui.showToast === 'function') {
        ui.showToast(`Zeni insuficiente! Você precisa de ${this.packCost} Zeni para abrir um pacote.`, '💰');
      }
      return null;
    }

    const newZeni = Math.max(0, currentZeni - this.packCost);
    if (authManager.user) {
      authManager.user.zeni = newZeni;
      authManager.saveUser();
    }
    deckBuilder.zeni = newZeni;
    if (ui && typeof ui.updateCurrencies === 'function') {
      ui.updateCurrencies();
    }

    soundEngine.playKiCharge();

    // Generate 3 random cards with rarity weightings & Holographic Foil chances
    const pulledCards = [];
    for (let i = 0; i < 3; i++) {
      const rand = Math.random();
      let pool = CARD_DATABASE.filter(c => c.rarity === 'common');
      if (rand > 0.85) {
        pool = CARD_DATABASE.filter(c => c.rarity === 'super-rare');
      } else if (rand > 0.50) {
        pool = CARD_DATABASE.filter(c => c.rarity === 'rare');
      }
      
      const card = pool[Math.floor(Math.random() * pool.length)] || CARD_DATABASE[0];
      
      // Foil Chance: 100% Super Rare, 35% Rare, 12% Common Chase Foil
      const isFoil = card.rarity === 'super-rare' || (card.rarity === 'rare' && Math.random() < 0.35) || (Math.random() < 0.12);
      const pulledCard = { ...card, isFoil };
      
      pulledCards.push(pulledCard);
      
      // Add card to player collection
      authManager.addCardToInventory(card.id);
    }

    soundEngine.playAwaken();
    if (ui && typeof ui.showToast === 'function') {
      const hasFoil = pulledCards.some(c => c.isFoil);
      const msg = hasFoil 
        ? `✨ INCRÍVEL! Você tirou cartas HOFOIL HOLOGRÁFICAS no pacote!` 
        : `Pacote aberto com sucesso! 3 novas cartas adicionadas à sua Coleção!`;
      ui.showToast(msg, hasFoil ? '✨' : '🎴');
    }
    return pulledCards;
  }
}

export const packOpener = new PackOpener();
