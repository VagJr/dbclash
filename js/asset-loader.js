/* ==========================================================================
   Dragon Ball Clash Action TCG - Asset Loader & PNG Pipeline Engine
   ========================================================================== */

import { i18n } from './i18n.js';
import { escapeHtml } from './safe-dom.js';
import { getCardById } from './card-database.js';

const TEMPORARY_CHAR_ART = {
  goku: { attack: 'atk_01', beam: 'atk_02', defense: 'def_01', counter: 'ctr_07', evade: 'evd_01', tech: 'tch_01' },
  vegeta: { attack: 'atk_03', beam: 'atk_08', defense: 'def_06', counter: 'ctr_02', evade: null, tech: 'tch_04' },
  gohan: { attack: 'atk_09', beam: 'atk_16', defense: 'def_11', counter: 'ctr_09', evade: 'evd_08', tech: 'tch_05' },
  piccolo: { attack: 'atk_05', beam: 'atk_17', defense: 'def_05', counter: null, evade: null, tech: 'tch_07' },
  trunks: { attack: 'atk_06', beam: 'atk_10', defense: 'def_12', counter: 'ctr_06', evade: 'evd_07', tech: 'tch_08' },
  frieza: { attack: 'atk_07', beam: 'atk_18', defense: 'def_10', counter: 'ctr_08', evade: null, tech: 'tch_06' }
};

export function temporaryCardArt(card) {
  if (card.set === 'LEGACY' || !card.id.startsWith('nxs_')) return `assets/cards/${card.id}.png`;
  const category = card.isBeam ? 'beam' : card.type;
  const id = TEMPORARY_CHAR_ART[card.characterId]?.[category];
  if (id) return `assets/cards/${id}.png`;
  if (TEMPORARY_CHAR_ART[card.characterId]) return `assets/leaders/${card.characterId}.png`;
  return 'assets/rework/ui/portal.png';
}

export class AssetLoader {
  constructor() {
    this.failedImages = new Set();
    this.artRecords = new Map();
    if (typeof window !== 'undefined' && typeof fetch === 'function') this.loadArtManifest();
  }

  async loadArtManifest() {
    try {
      const response = await fetch('assets/rework/art-manifest.json', { cache: 'no-store' });
      if (!response.ok) return;
      const manifest = await response.json();
      for (const card of manifest.cards || []) {
        if (['imported-review', 'approved'].includes(card.status) && /^assets\/rework\/cards\/[a-zA-Z0-9_-]+\.png$/.test(card.cropPath || '')) {
          this.artRecords.set(card.id, card);
        }
      }
      window.dispatchEvent(new CustomEvent('dbclash:artReady'));
    } catch { /* Temporary art remains available when a manifest is offline. */ }
  }

  getLeaderImagePath(leaderId) {
    return `assets/leaders/${leaderId}.png`;
  }

  getCardImagePath(cardId) {
    try {
      if (typeof localStorage !== 'undefined') {
        const custom = localStorage.getItem(`dbtcg_custom_card_${cardId}`);
        if (custom) return custom;
      }
    } catch (e) {}
    const card = getCardById(cardId);
    return this.artRecords.get(cardId)?.cropPath || (card ? temporaryCardArt(card) : 'assets/rework/ui/portal.png');
  }

  getBackgroundPath(bgId = 'arena_chamber') {
    return `assets/backgrounds/${bgId}.png`;
  }

  // Generate 100% Full-Art PNG image tag with upper title banner & lower text description overlay
  renderCardArtHTML(card, options = {}) {
    const descText = i18n.lang === 'pt' 
      ? (card.descPt || card.description || '') 
      : (card.descEn || card.description || '');

    const artPath = this.getCardImagePath(card.id);
    const fallback = temporaryCardArt(card);
    const labels = { attack: 'ATAQUE', defense: 'DEFESA', counter: 'COUNTER', evade: 'ESQUIVA', tech: 'TÉCNICA' };
    const rarity = { common: 'C', rare: 'R', 'super-rare': 'SR' };
    const serial = Number(card.setNumber || card.collectionNumber || card.number || 0);
    const value = Number(card.type === 'defense' ? card.block : card.power) || 0;
    const cost = Number.isFinite(Number(options.cost)) ? Number(options.cost) : Number(card.cost) || 0;
    const kind = labels[card.type] || 'TÉCNICA';
    return `
      <div class="nexus-card-art" data-art-status="${this.artRecords.has(card.id) ? 'imported' : 'temporary'}" data-card-type="${escapeHtml(card.type || 'tech')}">
        <img src="${escapeHtml(artPath)}" alt="" aria-hidden="true" loading="lazy" decoding="async" class="nexus-art-backdrop" onerror="this.onerror=null;this.src='${escapeHtml(fallback)}';">
        <img src="${escapeHtml(artPath)}" alt="" aria-hidden="true" loading="lazy" decoding="async" class="card-full-art-img" onerror="this.onerror=null;this.src='${escapeHtml(fallback)}';">
      </div>
      <div class="nexus-card-topline"><span class="nexus-card-cost" aria-label="Custo ${cost} Ki">${cost}<small>KI</small></span><span class="nexus-card-power"><small>${card.type === 'defense' ? 'DEF' : 'ATK'}</small>${value.toLocaleString('pt-BR')}</span></div>
      <span class="nexus-card-kind">${escapeHtml(kind)}</span>
      <div class="card-desc-overlay">
        <span class="nexus-card-effect-type">${escapeHtml(kind)} · ${escapeHtml(card.archetypes?.[0] || card.archetype || card.synergyGroup || '')}</span><span class="card-desc-text">${escapeHtml(descText)}</span>
      </div>
      <div class="nexus-card-name"><span>${escapeHtml(card.name)}</span><b>${rarity[card.rarity] || 'C'}</b></div>
      <div class="nexus-card-meta"><span>${escapeHtml(card.characterName || card.characterId || kind)}</span><span>${serial ? String(serial).padStart(3, '0') : escapeHtml(card.id)} · 714</span></div>
    `;
  }

  // Generate Leader Portrait HTML (Supports Base & Awakened form PNGs)
  renderLeaderPortraitHTML(leader, isAwakened = false) {
    const leaderId = typeof leader === 'string' ? leader : (leader?.id || 'goku');
    const imageId = isAwakened ? `${leaderId}_awaken` : leaderId;
    const fallbackImageId = isAwakened ? `${leaderId}_awk` : leaderId;

    return `
      <img src="assets/leaders/${imageId}.png" alt="${leaderId}" class="leader-portrait-img" style="width:100%; height:100%; object-fit:cover; object-position:top center; border-radius:50%;" onerror="this.onerror=null; this.src='assets/leaders/${fallbackImageId}.png';">
    `;
  }
}

export const assetLoader = new AssetLoader();
