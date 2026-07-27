/* ==========================================================================
   Dragon Ball Clash Action TCG - Asset Loader & PNG Pipeline Engine
   ========================================================================== */

import { i18n } from './i18n.js';

export class AssetLoader {
  constructor() {
    this.failedImages = new Set();
  }

  getLeaderImagePath(leaderId) {
    return `assets/leaders/${leaderId}.png`;
  }

  getCardImagePath(cardId) {
<<<<<<< HEAD
    try {
      if (typeof localStorage !== 'undefined') {
        const custom = localStorage.getItem(`dbtcg_custom_card_${cardId}`);
        if (custom) return custom;
      }
    } catch (e) {}
=======
    const custom = localStorage.getItem(`dbtcg_custom_card_${cardId}`);
    if (custom) return custom;
>>>>>>> 75cdb2b5faac518831c31cadd3baa480b065f443
    return `assets/cards/${cardId}.png`;
  }

  getBackgroundPath(bgId = 'arena_chamber') {
    return `assets/backgrounds/${bgId}.png`;
  }

  // Generate 100% Full-Art PNG image tag with upper title banner & lower text description overlay
  renderCardArtHTML(card) {
    const descText = i18n.lang === 'pt' 
      ? (card.descPt || card.description || '') 
      : (card.descEn || card.description || '');

    return `
      <img src="assets/cards/${card.id}.png" alt="${card.name}" class="card-full-art-img" onerror="this.style.display='none';">
      <div class="card-header-banner">
        <span class="card-title-text">${card.name}</span>
      </div>
      <div class="card-desc-overlay">
        <span class="card-desc-text">${descText}</span>
      </div>
    `;
  }

  // Generate Leader Portrait HTML
  renderLeaderPortraitHTML(leader) {
    const leaderId = typeof leader === 'string' ? leader : leader.id;
    return `
      <img src="assets/leaders/${leaderId}.png" alt="${leaderId}" class="leader-portrait-img" style="width:100%; height:100%; object-fit:cover; object-position:top center; border-radius:50%;" onerror="this.style.display='none'; if (this.nextElementSibling) this.nextElementSibling.style.display='flex';">
      <span class="leader-portrait-fallback" style="display:none;">⚡</span>
    `;
  }
}

export const assetLoader = new AssetLoader();
