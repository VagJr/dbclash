/* ==========================================================================
   Dragon Ball Clash Action TCG — AAA Game Scene Manager & Finite State Machine
   Console/PC Navigation Engine: Splash, Press Start, Intro, Main Menu & Arena
   ========================================================================== */

import { soundEngine } from './audio.js';

export const GAME_SCENES = {
  SPLASH: 'scene-splash',
  TITLE: 'scene-title',
  INTRO: 'scene-intro',
  MAIN_MENU: 'scene-main-menu',
  FIGHTER_SELECT: 'scene-fighter-select',
  ARENA: 'scene-arena',
  DECK_LAB: 'scene-deck-lab',
  SHOP: 'scene-shop',
  DOJOS: 'scene-dojos',
  CHAT: 'scene-chat',
  RANKED: 'scene-ranked',
  QUESTS: 'scene-quests',
  PROFILE: 'scene-profile'
};

export class SceneManager {
  constructor() {
    this.currentScene = GAME_SCENES.SPLASH;
    this.previousScene = null;
    this.transitionOverlay = null;
    this.transitionVersion = 0;
    this.pendingSceneId = null;
    this.enterTimer = null;
    this.exitTimer = null;
    this.unlockedFeatures = {
      fighterSelect: true,
      arenaVsAi: true,
      training: true,
      onlineRooms: false,
      deckLab: false,
      shop: false
    };

    this.initTransitionOverlay();
  }

  initTransitionOverlay() {
    if (typeof document === 'undefined') return;
    this.transitionOverlay = document.getElementById('scene-transition-overlay');
    if (!this.transitionOverlay) {
      const overlay = document.createElement('div');
      overlay.id = 'scene-transition-overlay';
      overlay.className = 'scene-transition-curtain';
      document.body.appendChild(overlay);
      this.transitionOverlay = overlay;
    }
  }

  switchScene(targetSceneId, options = {}) {
    if (this.currentScene === targetSceneId && !options.force && !this.pendingSceneId) return;

    const targetEl = document.getElementById(targetSceneId);

    if (!targetEl) {
      console.warn(`[SceneManager] Target scene element not found: ${targetSceneId}`);
      return;
    }

    const transitionVersion = ++this.transitionVersion;
    clearTimeout(this.enterTimer);
    clearTimeout(this.exitTimer);
    this.pendingSceneId = targetSceneId;

    if (!options.silent) soundEngine.playClick();

    const allScenes = document.querySelectorAll('.game-scene');

    // Trigger Energy Wipe Transition Curtain
    if (this.transitionOverlay && !options.skipTransition) {
      this.transitionOverlay.classList.add('active');
      
      this.enterTimer = setTimeout(() => {
        if (transitionVersion !== this.transitionVersion) return;
        try {
          allScenes.forEach(s => s.classList.remove('active'));
          targetEl.classList.add('active');

          this.previousScene = this.currentScene;
          this.currentScene = targetSceneId;
          this.pendingSceneId = null;

          this.onSceneEnter(targetSceneId, options);
        } catch (err) {
          console.error('[SceneManager] Error during scene transition:', err);
        } finally {
          this.exitTimer = setTimeout(() => {
            if (transitionVersion !== this.transitionVersion) return;
            if (this.transitionOverlay) this.transitionOverlay.classList.remove('active');
          }, 300);
        }
      }, 350);
    } else {
      try {
        this.transitionOverlay?.classList.remove('active');
        allScenes.forEach(s => s.classList.remove('active'));
        targetEl.classList.add('active');

        this.previousScene = this.currentScene;
        this.currentScene = targetSceneId;
        this.pendingSceneId = null;

        this.onSceneEnter(targetSceneId, options);
      } catch (err) {
        console.error('[SceneManager] Error entering scene:', err);
      }
    }
  }

  onSceneEnter(sceneId, options) {
    // Audio director follows the scene instead of leaving battle/menu tracks orphaned.
    if (sceneId === GAME_SCENES.ARENA) {
      soundEngine.playBattleTheme?.();
      soundEngine.startAmbience?.('battle');
      if (typeof document !== 'undefined') document.body.classList.add('arena-active');
    } else if (sceneId === GAME_SCENES.RANKED) {
      soundEngine.playQueueTheme?.();
      soundEngine.startAmbience?.('queue');
      if (typeof document !== 'undefined') document.body.classList.remove('arena-active');
    } else {
      soundEngine.playMenuTheme?.();
      soundEngine.startAmbience?.('menu');
      if (typeof document !== 'undefined') document.body.classList.remove('arena-active');
    }

    // Dispatch scene change custom event
    window.dispatchEvent(new CustomEvent('dbtcg:sceneChange', {
      detail: { sceneId, previousScene: this.previousScene, options }
    }));
  }

  unlockFeature(featureKey) {
    if (this.unlockedFeatures.hasOwnProperty(featureKey)) {
      this.unlockedFeatures[featureKey] = true;
      this.updateMenuUnlocksUI();
      soundEngine.playAwaken();
    }
  }

  updateMenuUnlocksUI() {
    const menuNodes = document.querySelectorAll('[data-unlock-feature]');
    menuNodes.forEach(node => {
      const key = node.getAttribute('data-unlock-feature');
      if (this.unlockedFeatures[key]) {
        node.classList.remove('feature-locked');
        const badge = node.querySelector('.lock-badge');
        if (badge) badge.style.display = 'none';
      } else {
        node.classList.add('feature-locked');
      }
    });
  }
}

export const sceneManager = new SceneManager();
