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
  }

  playAttackSequence(config) {
    if (config && typeof config.onImpact === 'function') {
      config.onImpact();
    }
  }
}

export const cutsceneEngine = new CutsceneEngine();
