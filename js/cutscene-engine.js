/* ==========================================================================
   Dragon Ball Clash Action TCG - Cinematic Anime Combat Cut-In Engine
   Manages 3-stage anime attacks, blend-mode VFX overlays, impact frames & screen shakes
   ========================================================================== */

import { soundEngine } from './audio.js';
import { ANIMATION_CATALOG, ANIMATION_TYPES } from './animation-catalog.js';

export class CutsceneEngine {
  constructor() {
    this.overlay = null;
    this.impactOverlay = null;
    this.speedLinesOverlay = null;
    this.vfxContainer = null;
    this.createCutsceneDOM();
  }

  createCutsceneDOM() {
    if (typeof document === 'undefined') return;

    // 1. Anime Cutscene Overlay Banner
    if (!document.getElementById('anime-cutscene-overlay')) {
      this.overlay = document.createElement('div');
      this.overlay.id = 'anime-cutscene-overlay';
      this.overlay.className = 'anime-cutscene-overlay';
      this.overlay.innerHTML = `
        <div class="cutscene-banner">
          <div class="cutscene-speed-lines active"></div>
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
    } else {
      this.overlay = document.getElementById('anime-cutscene-overlay');
    }

    // 2. Global Impact Frame Flash
    this.impactOverlay = document.getElementById('impact-frame-overlay');
    if (!this.impactOverlay) {
      this.impactOverlay = document.createElement('div');
      this.impactOverlay.id = 'impact-frame-overlay';
      document.body.appendChild(this.impactOverlay);
    }

    // 3. Dynamic VFX Overlay Container
    if (!document.getElementById('vfx-overlay-container')) {
      this.vfxContainer = document.createElement('div');
      this.vfxContainer.id = 'vfx-overlay-container';
      this.vfxContainer.style.cssText = 'position:fixed; inset:0; pointer-events:none; z-index:2500; overflow:hidden;';
      document.body.appendChild(this.vfxContainer);
    } else {
      this.vfxContainer = document.getElementById('vfx-overlay-container');
    }
  }

  triggerImpactFrame(durationMs = 150) {
    if (!this.impactOverlay) return;
    this.impactOverlay.classList.remove('active');
    // Force reflow
    void this.impactOverlay.offsetWidth;
    this.impactOverlay.classList.add('active');
    setTimeout(() => {
      this.impactOverlay.classList.remove('active');
    }, durationMs);
  }

  triggerScreenShake(shakeClass = 'shake-md') {
    const arena = document.getElementById('arena-screen') || document.body;
    arena.classList.remove('shake-sm', 'shake-md', 'shake-heavy');
    void arena.offsetWidth;
    arena.classList.add(shakeClass);
    setTimeout(() => {
      arena.classList.remove(shakeClass);
    }, 600);
  }

  spawnFloatingDamage(targetEl, amount) {
    if (!targetEl || !amount) return;
    const rect = targetEl.getBoundingClientRect();
    const dmgEl = document.createElement('div');
    dmgEl.className = 'dmg-float-number';
    dmgEl.textContent = `-${amount}`;
    dmgEl.style.left = `${rect.left + rect.width / 2 - 40}px`;
    dmgEl.style.top = `${rect.top + rect.height / 2 - 20}px`;

    document.body.appendChild(dmgEl);
    setTimeout(() => {
      if (dmgEl.parentNode) dmgEl.parentNode.removeChild(dmgEl);
    }, 900);
  }

  playVFXOverlay(config, targetEl) {
    if (!config) return;

    const sheetUrl = config.spriteSheetUrl || config.vfxUrl;
    if (!sheetUrl) return;

    const canvas = document.createElement('canvas');
    const size = 180;
    canvas.width = size;
    canvas.height = size;
    canvas.style.imageRendering = 'pixelated';

    let left = window.innerWidth / 2 - size / 2;
    let top = window.innerHeight / 2 - size / 2;

    if (targetEl) {
      const rect = targetEl.getBoundingClientRect();
      left = rect.left + rect.width / 2 - size / 2;
      top = rect.top + rect.height / 2 - size / 2;
    }

    canvas.style.cssText = `position:absolute; left:${left}px; top:${top}px; width:${size}px; height:${size}px; pointer-events:none; z-index:2600; mix-blend-mode:${config.blendMode || 'screen'}; filter:drop-shadow(0 0 16px rgba(255,215,0,0.5));`;
    this.vfxContainer.appendChild(canvas);

    const ctx = canvas.getContext('2d');
    if (ctx) ctx.imageSmoothingEnabled = false;

    const img = new Image();
    img.onload = () => {
      const totalFrames = config.totalFrames || 8;
      const fw = config.frameWidth || (img.width / totalFrames);
      const fh = config.frameHeight || img.height;
      const fps = config.fps || 12;
      let frame = 0;

      const timer = setInterval(() => {
        if (!ctx) return;
        ctx.clearRect(0, 0, size, size);
        ctx.drawImage(img, frame * fw, 0, fw, fh, 0, 0, size, size);
        frame++;
        if (frame >= totalFrames) {
          clearInterval(timer);
          if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
        }
      }, 1000 / fps);
    };
    img.src = sheetUrl;
  }

  playAttackSequence({ type = ANIMATION_TYPES.PHYSICAL_ATTACK, leaderIcon = '⚡', leaderName = 'Goku', attackName = 'Attacking', targetEl = null, damage = 0, customQuote = null, onImpact = null }) {
    const config = ANIMATION_CATALOG[type] || ANIMATION_CATALOG[ANIMATION_TYPES.PHYSICAL_ATTACK];

    // Sound effect
    if (config.soundKey && typeof soundEngine[config.soundKey] === 'function') {
      soundEngine[config.soundKey]();
    } else if (typeof soundEngine.playPunch === 'function') {
      soundEngine.playPunch();
    }

    // Is Special Cutscene (Kamehameha, Genki Dama, Final Flash)?
    const isSpecial = [ANIMATION_TYPES.SUPER_KAMEHAMEHA, ANIMATION_TYPES.GENKI_DAMA, ANIMATION_TYPES.FINAL_FLASH, ANIMATION_TYPES.DEATH_BEAM].includes(type);

    if (isSpecial) {
      const portraitEl = document.getElementById('cutscene-portrait');
      const titleEl = document.getElementById('cutscene-title');
      const quoteEl = document.getElementById('cutscene-quote');
      const bannerEl = this.overlay.querySelector('.cutscene-banner');

      if (portraitEl) portraitEl.textContent = leaderIcon;
      if (titleEl) titleEl.textContent = attackName || config.name;
      if (quoteEl) quoteEl.textContent = `"${customQuote || config.quote || 'HAAAAAA!'}"`;
      if (bannerEl) bannerEl.style.borderColor = config.color || '#ffd700';

      this.overlay.classList.add('active');

      setTimeout(() => {
        this.overlay.classList.remove('active');
        
        // Stage 2: Beam/VFX Release & Impact
        if (config.impactFrame) this.triggerImpactFrame(200);
        this.triggerScreenShake(config.shakeClass);
        if (!config.skipTargetVfx) {
          this.playVFXOverlay(config, targetEl);
        }

        if (damage > 0 && targetEl) {
          this.spawnFloatingDamage(targetEl, damage);
        }

        if (typeof onImpact === 'function') onImpact();
      }, config.cutinDurationMs || 900);
    } else {
      // Direct Physical or Ki Attack
      if (config.impactFrame) this.triggerImpactFrame(120);
      this.triggerScreenShake(config.shakeClass);
      if (!config.skipTargetVfx) {
        this.playVFXOverlay(config, targetEl);
      }

      if (damage > 0 && targetEl) {
        this.spawnFloatingDamage(targetEl, damage);
      }

      if (typeof onImpact === 'function') onImpact();
    }
  }
}

export const cutsceneEngine = new CutsceneEngine();
