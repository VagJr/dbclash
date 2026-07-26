/* ==========================================================================
   Dragon Ball Clash Action TCG - Cinematic Anime Combat Cut-In Engine
   ========================================================================== */

import { soundEngine } from './audio.js';

export class CutsceneEngine {
  constructor() {
    this.overlay = null;
    this.createCutsceneDOM();
  }

  createCutsceneDOM() {
    if (typeof document === 'undefined') return;
    this.overlay = document.createElement('div');
    this.overlay.id = 'anime-cutscene-overlay';
    this.overlay.className = 'anime-cutscene-overlay';
    this.overlay.innerHTML = `
      <div class="cutscene-banner">
        <div class="cutscene-speed-lines"></div>
        <div class="cutscene-portrait-box">
          <div id="cutscene-portrait" class="cutscene-portrait">⚡</div>
        </div>
        <div class="cutscene-text-box">
          <div id="cutscene-title" class="cutscene-title">KAMEHAMEHA!</div>
          <div id="cutscene-quote" class="cutscene-quote">"KA... ME... HA... ME... HAAAA!"</div>
        </div>
      </div>
    `;
    document.body.appendChild(this.overlay);
  }

  triggerCutscene(leaderIcon, attackName, battleQuote, color = '#ffd700', durationMs = 1000) {
    const portraitEl = document.getElementById('cutscene-portrait');
    const titleEl = document.getElementById('cutscene-title');
    const quoteEl = document.getElementById('cutscene-quote');
    const bannerEl = this.overlay.querySelector('.cutscene-banner');

    if (portraitEl) portraitEl.textContent = leaderIcon;
    if (titleEl) titleEl.textContent = attackName;
    if (quoteEl) quoteEl.textContent = `"${battleQuote}"`;
    if (bannerEl) bannerEl.style.borderColor = color;

    soundEngine.playAwaken();

    this.overlay.classList.add('active');
    setTimeout(() => {
      this.overlay.classList.remove('active');
    }, durationMs);
  }
}

export const cutsceneEngine = new CutsceneEngine();
