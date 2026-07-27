<<<<<<< HEAD
/* ==========================================================================
   Dragon Ball Clash Action TCG — UI Manager (Redesigned Layout Engine)
   Anime action indicators, opponent played card display, touch gesture popups,
   Card Inspect Modal & Full PT-BR/EN i18n support
   ========================================================================== */

import { GameEngine } from './game-engine.js';
import { MultiplayerManager } from './multiplayer-manager.js';
import { deckBuilder } from './deck-builder.js';
import { packOpener } from './pack-opener.js';
import { chatManager, DOJO_RANKINGS } from './chat-manager.js';
import { FXEngine } from './fx-engine.js';
import { TutorialManager } from './tutorial-manager.js';
import { characterUnlocks } from './character-unlocks.js';
import { assetLoader } from './asset-loader.js';
import { cutsceneEngine } from './cutscene-engine.js';
import { ANIMATION_TYPES } from './animation-catalog.js';
import { soundEngine } from './audio.js';
import { getCardById, LEADERS, getStarterDeckForLeader, CARD_DATABASE } from './card-database.js';
import { authDatabase } from './auth-database.js';
import { i18n } from './i18n.js';

import { sceneManager, GAME_SCENES } from './scene-manager.js';

export class UIManager {
  constructor() {
    this.fx = new FXEngine('fx-canvas');
    this.startFighterSpriteLoop();

    this.gameEngine = new GameEngine(
      this.renderArena.bind(this),
      this.handleFXEvent.bind(this)
    );

    this.gameEngine.onTimerTick = (secondsLeft, maxSec = 3.0) => {
      if (this.timerBarFill) {
        const pct = (secondsLeft / maxSec) * 100;
        this.timerBarFill.style.width = `${Math.max(0, pct)}%`;
      }
    };

    this.multiplayer = new MultiplayerManager(this.gameEngine);
    this.tutorial = new TutorialManager(this);

    this.selectedLeader = 'goku';
    this.draggedCardIndex = null;
    this.actionBannerTimer = null;

    this.initDOM();
    this.initCardInspectModal();
    this.bindNavigation();
    this.bindEvents();
    this.updateUserSessionUI();
    this.applyTranslations();
    this.renderLeaderSelectionRoster();
    this.initDevPanel();
    this.initSceneSystem();
  }


  triggerScreenShake() {
    const screen = document.getElementById('arena-screen');
    if (!screen) return;
    screen.classList.remove('shake-screen');
    void screen.offsetWidth;
    screen.classList.add('shake-screen');
    setTimeout(() => screen.classList.remove('shake-screen'), 400);
  }

  triggerFloatingDamage(x, y, text) {
    const el = document.createElement('div');
    el.className = 'floating-damage-popup';
    el.textContent = text;
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    document.getElementById('arena-screen')?.appendChild(el);
    setTimeout(() => el.remove(), 850);
  }

  /* ── Anime Action Splash Banner ────────────────────────────────────── */
  triggerActionBanner(text, actClass = 'act-attack') {
    let banner = document.getElementById('anime-action-banner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'anime-action-banner';
      banner.className = 'anime-action-banner';
      document.getElementById('arena-screen')?.appendChild(banner);
    }
    banner.textContent = text;
    banner.className = `anime-action-banner ${actClass} active`;
    if (this.actionBannerTimer) clearTimeout(this.actionBannerTimer);
    this.actionBannerTimer = setTimeout(() => {
      banner.classList.remove('active');
    }, 1100);
  }

  getBeamVector(attackerKey) {
    const p1Box = document.getElementById('p1-leader-box');
    const p2Box = document.getElementById('p2-leader-box');

    let p1X = window.innerWidth / 2;
    let p1Y = window.innerHeight - 150;
    if (p1Box) {
      const rect = p1Box.getBoundingClientRect();
      p1X = rect.left + rect.width / 2;
      p1Y = rect.top + rect.height / 2;
    }

    let p2X = window.innerWidth / 2;
    let p2Y = 130;
    if (p2Box) {
      const rect = p2Box.getBoundingClientRect();
      p2X = rect.left + rect.width / 2;
      p2Y = rect.top + rect.height / 2;
    }

    if (attackerKey === 'player') {
      return { fromX: p1X, fromY: p1Y, toX: p2X, toY: p2Y }; // Player -> Opponent (Bottom to Top)
    } else {
      return { fromX: p2X, fromY: p2Y, toX: p1X, toY: p1Y }; // Opponent -> Player (Top to Bottom)
    }
  }

  /* ── FX Event Handler ──────────────────────────────────────────────── */
  handleFXEvent(type, data = {}) {
    if (!this.fx) return;
    const attackerKey = data.attackerKey || (this.gameEngine ? this.gameEngine.initiative : 'player');
    const leader = (attackerKey === 'opponent' ? this.gameEngine?.opponent?.leader : this.gameEngine?.player?.leader) || {};
    const targetBox = document.getElementById(attackerKey === 'opponent' ? 'p1-leader-box' : 'p2-leader-box');
    const vec = this.getBeamVector(attackerKey);

    if (type === 'kiAura') {
      soundEngine.playKiCharge();
      this.triggerActionBanner('⚡ CARREGAR KI! (+2 KI)', 'act-charge');
      this.fx.spawnKiAura(vec.fromX, vec.fromY, data.color);
    } else if (type === 'beamClash') {
      soundEngine.playBeamBlast();
      this.triggerScreenShake();
      this.triggerActionBanner('⚡ BEAM CLASH TUG-OF-WAR!', 'act-attack');
      this.fx.triggerBeamClash(data.p1Progress, data.p1Color, data.p2Color);
    } else if (type === 'kamehameha') {
      const cardTitle = data.card ? data.card.name.toUpperCase() : 'SUPER KAMEHAMEHA!';
      this.triggerActionBanner(`🔥 ${cardTitle}`, 'act-attack');
      cutsceneEngine.playAttackSequence({
        type: ANIMATION_TYPES.SUPER_KAMEHAMEHA,
        leaderIcon: leader.icon || '🔥',
        leaderName: leader.name || 'Goku',
        attackName: cardTitle,
        targetEl: targetBox,
        damage: data.damage || 40,
        customQuote: leader.quote || 'KA... ME... HA... ME... HAAA!',
        onImpact: () => {
          this.fx.fireKamehameha(vec.fromX, vec.fromY, vec.toX, vec.toY, data.isGolden);
        }
      });
    } else if (type === 'genkidama') {
      const cardTitle = data.card ? data.card.name.toUpperCase() : 'GENKI DAMA!';
      this.triggerActionBanner(`🌐 ${cardTitle}`, 'act-attack');
      cutsceneEngine.playAttackSequence({
        type: ANIMATION_TYPES.GENKI_DAMA,
        leaderIcon: leader.icon || '🌐',
        leaderName: leader.name || 'Goku',
        attackName: cardTitle,
        targetEl: targetBox,
        damage: data.damage || 60,
        customQuote: 'TODOS DA TERRA, ME DÊEM SUA ENERGIA!',
        onImpact: () => {
          this.fx.fireGenkiDama(vec.fromX, vec.fromY, vec.toX, vec.toY);
        }
      });
    } else if (type === 'finalFlash') {
      const cardTitle = data.card ? data.card.name.toUpperCase() : 'FINAL FLASH!';
      this.triggerActionBanner(`⚡ ${cardTitle}`, 'act-attack');
      cutsceneEngine.playAttackSequence({
        type: ANIMATION_TYPES.FINAL_FLASH,
        leaderIcon: leader.icon || '⚡',
        leaderName: leader.name || 'Vegeta',
        attackName: cardTitle,
        targetEl: targetBox,
        damage: data.damage || 50,
        customQuote: 'FINAL... FLAAAASH!',
        onImpact: () => {
          this.fx.fireFinalFlash(vec.fromX, vec.fromY, vec.toX, vec.toY);
        }
      });
    } else if (type === 'deathBeam') {
      const cardTitle = data.card ? data.card.name.toUpperCase() : 'DEATH BEAM!';
      this.triggerActionBanner(`👿 ${cardTitle}`, 'act-attack');
      cutsceneEngine.playAttackSequence({
        type: ANIMATION_TYPES.DEATH_BEAM,
        leaderIcon: leader.icon || '👿',
        leaderName: leader.name || 'Frieza',
        attackName: cardTitle,
        targetEl: targetBox,
        damage: data.damage || 35,
        customQuote: 'DANCE PARA MIM, MACACO!',
        onImpact: () => {
          this.fx.fireDeathBeam(vec.fromX, vec.fromY, vec.toX, vec.toY);
        }
      });
    } else if (type === 'specialBeam') {
      const cardTitle = data.card ? data.card.name.toUpperCase() : 'SPECIAL BEAM CANNON!';
      this.triggerActionBanner(`🌀 ${cardTitle}`, 'act-attack');
      cutsceneEngine.playAttackSequence({
        type: ANIMATION_TYPES.DEATH_BEAM,
        leaderIcon: leader.icon || '🌀',
        leaderName: leader.name || 'Piccolo',
        attackName: cardTitle,
        targetEl: targetBox,
        damage: data.damage || 45,
        customQuote: 'MAKANKOSAPPO!',
        onImpact: () => {
          this.fx.fireSpecialBeam(vec.fromX, vec.fromY, vec.toX, vec.toY);
        }
      });
    } else if (type === 'masenko') {
      const cardTitle = data.card ? data.card.name.toUpperCase() : 'MASENKO!';
      this.triggerActionBanner(`💥 ${cardTitle}`, 'act-attack');
      cutsceneEngine.playAttackSequence({
        type: ANIMATION_TYPES.SUPER_KAMEHAMEHA,
        leaderIcon: leader.icon || '💥',
        leaderName: leader.name || 'Gohan',
        attackName: cardTitle,
        targetEl: targetBox,
        damage: data.damage || 40,
        customQuote: 'MASENKO... HA!',
        onImpact: () => {
          this.fx.fireMasenko(vec.fromX, vec.fromY, vec.toX, vec.toY);
        }
      });
    } else if (type === 'bigBang') {
      const cardTitle = data.card ? data.card.name.toUpperCase() : 'BIG BANG ATTACK!';
      this.triggerActionBanner(`🔵 ${cardTitle}`, 'act-attack');
      cutsceneEngine.playAttackSequence({
        type: ANIMATION_TYPES.SUPER_KAMEHAMEHA,
        leaderIcon: leader.icon || '🔵',
        leaderName: leader.name || 'Vegeta',
        attackName: cardTitle,
        targetEl: targetBox,
        damage: data.damage || 55,
        customQuote: 'BIG BANG ATTACK!',
        onImpact: () => {
          this.fx.fireBigBang(vec.fromX, vec.fromY, vec.toX, vec.toY);
        }
      });
    } else if (type === 'burningAttack') {
      const cardTitle = data.card ? data.card.name.toUpperCase() : 'BURNING ATTACK!';
      this.triggerActionBanner(`🔥 ${cardTitle}`, 'act-attack');
      cutsceneEngine.playAttackSequence({
        type: ANIMATION_TYPES.SUPER_KAMEHAMEHA,
        leaderIcon: leader.icon || '🔥',
        leaderName: leader.name || 'Trunks',
        attackName: cardTitle,
        targetEl: targetBox,
        damage: data.damage || 45,
        customQuote: 'BURNING ATTACK!',
        onImpact: () => {
          this.fx.fireBurningAttack(vec.fromX, vec.fromY, vec.toX, vec.toY);
        }
      });
    } else if (type === 'punch') {
      const cardTitle = data.card ? data.card.name.toUpperCase() : 'IMPACTO DIRETO!';
      this.triggerActionBanner(`💥 ${cardTitle}`, 'act-attack');
      cutsceneEngine.playAttackSequence({
        type: ANIMATION_TYPES.PHYSICAL_ATTACK,
        leaderIcon: leader.icon || '💥',
        leaderName: leader.name || 'Fighter',
        attackName: cardTitle,
        targetEl: targetBox,
        damage: data.damage || 25,
        onImpact: () => {
          this.fx.triggerImpactHit(vec.toX, vec.toY);
        }
      });
    } else if (type === 'supernova') {
      const cardTitle = data.card ? data.card.name.toUpperCase() : 'SUPERNOVA!';
      this.triggerActionBanner(`☀️ ${cardTitle}`, 'act-attack');
      cutsceneEngine.playAttackSequence({
        type: ANIMATION_TYPES.GENKI_DAMA,
        leaderIcon: leader.icon || '☀️',
        leaderName: leader.name || 'Frieza',
        attackName: cardTitle,
        targetEl: targetBox,
        damage: data.damage || 75,
        customQuote: 'ESTE PLANETA VAI CASSAR EM POEIRA!',
        onImpact: () => {
          this.fx.fireSupernova(vec.fromX, vec.fromY, vec.toX, vec.toY);
        }
      });
    } else if (type === 'kienzan') {
      const cardTitle = data.card ? data.card.name.toUpperCase() : 'KIENZAN!';
      this.triggerActionBanner(`✨ ${cardTitle}`, 'act-attack');
      cutsceneEngine.playAttackSequence({
        type: ANIMATION_TYPES.KI_BLAST,
        leaderIcon: leader.icon || '✨',
        leaderName: leader.name || 'Fighter',
        attackName: cardTitle,
        targetEl: targetBox,
        damage: data.damage || 45,
        onImpact: () => {
          this.fx.fireKienzan(vec.fromX, vec.fromY, vec.toX, vec.toY);
        }
      });
    } else if (type === 'kikoho') {
      const cardTitle = data.card ? data.card.name.toUpperCase() : 'KIKOHO TRI-BEAM!';
      this.triggerActionBanner(`🟨 ${cardTitle}`, 'act-attack');
      cutsceneEngine.playAttackSequence({
        type: ANIMATION_TYPES.SUPER_KAMEHAMEHA,
        leaderIcon: leader.icon || '🟨',
        leaderName: leader.name || 'Tien',
        attackName: cardTitle,
        targetEl: targetBox,
        damage: data.damage || 50,
        customQuote: 'KIKOHOOOO!',
        onImpact: () => {
          this.fx.triggerImpactHit(vec.toX, vec.toY);
        }
      });
    } else if (type === 'dragonFist') {
      const cardTitle = data.card ? data.card.name.toUpperCase() : 'DRAGON FIST RUSH!';
      this.triggerActionBanner(`🐉 ${cardTitle}`, 'act-attack');
      cutsceneEngine.playAttackSequence({
        type: ANIMATION_TYPES.PHYSICAL_ATTACK,
        leaderIcon: leader.icon || '🐉',
        leaderName: leader.name || 'Goku',
        attackName: cardTitle,
        targetEl: targetBox,
        damage: data.damage || 35,
        customQuote: 'SE SEU PODER NÃO É SUFICIENTE, EU TE ATRAVESSAREI!',
        onImpact: () => {
          this.fx.triggerImpactHit(vec.toX, vec.toY);
        }
      });
    } else if (type === 'meteorCombination') {
      const cardTitle = data.card ? data.card.name.toUpperCase() : 'METEOR COMBINATION!';
      this.triggerActionBanner(`🥊 ${cardTitle}`, 'act-attack');
      cutsceneEngine.playAttackSequence({
        type: ANIMATION_TYPES.PHYSICAL_ATTACK,
        leaderIcon: leader.icon || '🥊',
        leaderName: leader.name || 'Fighter',
        attackName: cardTitle,
        targetEl: targetBox,
        damage: data.damage || 25,
        onImpact: () => {
          this.fx.fireMeteorCombination(vec.fromX, vec.fromY, vec.toX, vec.toY);
        }
      });
    } else if (type === 'spiritSword') {
      const cardTitle = data.card ? data.card.name.toUpperCase() : 'SPIRIT SWORD SLASH!';
      this.triggerActionBanner(`🗡️ ${cardTitle}`, 'act-attack');
      cutsceneEngine.playAttackSequence({
        type: ANIMATION_TYPES.SUPER_KAMEHAMEHA,
        leaderIcon: leader.icon || '🗡️',
        leaderName: leader.name || 'Trunks',
        attackName: cardTitle,
        targetEl: targetBox,
        damage: data.damage || 45,
        customQuote: 'ESTE É O PODER DA ESPADA DA ESPERANÇA!',
        onImpact: () => {
          this.fx.fireSpiritSword(vec.fromX, vec.fromY, vec.toX, vec.toY);
        }
      });
    } else if (type === 'kiBlast') {
      const cardTitle = data.card ? data.card.name.toUpperCase() : 'DISPARO DE KI!';
      this.triggerActionBanner(`⚡ ${cardTitle}`, 'act-attack');
      cutsceneEngine.playAttackSequence({
        type: ANIMATION_TYPES.KI_BLAST,
        leaderIcon: leader.icon || '⚡',
        leaderName: leader.name || 'Fighter',
        attackName: cardTitle,
        targetEl: targetBox,
        damage: data.damage || 20,
        onImpact: () => {
          this.fx.triggerImpactHit(vec.toX, vec.toY);
        }
      });
    } else if (type === 'zvanish') {
      soundEngine.playZVanish();
      this.triggerActionBanner('💨 Z-VANISH TELEPORT!', 'act-evade');
      this.fx.triggerZVanish(data.x || 500, data.y || 250, data.color);
    } else if (type === 'awaken') {
      soundEngine.playAwaken();
      this.triggerActionBanner('🔥 AWAKEN TRANSFORMAÇÃO!', 'act-charge');
      cutsceneEngine.playAttackSequence({
        type: ANIMATION_TYPES.SUPER_KAMEHAMEHA,
        leaderIcon: '🔥',
        leaderName: leader.name || 'Fighter',
        attackName: 'AWAKEN TRANSFORMATION!',
        targetEl: document.getElementById('p1-leader-box'),
        customQuote: 'ESTE É MEU PODER TOTAL!',
        onImpact: () => {
          this.fx.triggerAwakenBurst(data.x || 500, data.color);
        }
      });
    }
  }

  /* ── Card Inspect Modal Handler ────────────────────────────────────── */
  initCardInspectModal() {
    this.cardInspectModal = document.getElementById('card-inspect-modal');
    this.cardInspectClose = document.getElementById('card-inspect-close');
    
    if (this.cardInspectClose) {
      this.cardInspectClose.addEventListener('click', () => {
        this.cardInspectModal?.classList.remove('active');
      });
    }
    this.cardInspectModal?.addEventListener('click', (e) => {
      if (e.target === this.cardInspectModal) {
        this.cardInspectModal.classList.remove('active');
      }
    });
  }

  openCardInspectModal(card) {
    if (!card || !this.cardInspectModal) return;
    soundEngine.playClick();
    
    const preview = document.getElementById('card-inspect-preview');
    const nameEl = document.getElementById('inspect-card-name');
    const typeEl = document.getElementById('inspect-card-type');
    const descEl = document.getElementById('inspect-card-desc');
    const costEl = document.getElementById('inspect-card-cost');
    const powerEl = document.getElementById('inspect-card-power');

    if (preview) {
      preview.innerHTML = `
        <div class="card type-${card.type}${card.rarity === 'super-rare' ? ' super-rare' : ''}">
          ${assetLoader.renderCardArtHTML(card)}
          <div class="card-header"><div class="card-ki-cost">${card.cost}</div></div>
          <div class="card-type-tag tag-${card.type}">${card.type.toUpperCase()}</div>
          ${card.power > 0 ? `<div class="card-power-badge">${card.power} ATK</div>` : ''}
        </div>
      `;
    }

    if (nameEl) nameEl.textContent = card.name;
    if (typeEl) {
      typeEl.textContent = `${card.rarity.toUpperCase()} — ${card.type.toUpperCase()}`;
      typeEl.className = `inspect-type-badge tag-${card.type}`;
    }
    if (descEl) descEl.textContent = i18n.lang === 'pt' ? (card.descPt || card.description) : (card.descEn || card.description);
    if (costEl) costEl.textContent = `⚡ Ki Cost: ${card.cost}`;
    if (powerEl) powerEl.textContent = card.power > 0 ? `💥 Power: ${card.power} ATK` : '🛡️ Special Skill';

    this.cardInspectModal.classList.add('active');
  }

  /* ── DOM References ────────────────────────────────────────────────── */
  initDOM() {
    // Navigation
    this.sidebarItems = document.querySelectorAll('#sidebar .nav-item');
    this.bottomTabs = document.querySelectorAll('#bottom-bar .btab');
    this.screens = document.querySelectorAll('.screen');

    // Header
    this.langSwitchBtn = document.getElementById('lang-switch-btn');
    this.authBtn = document.getElementById('auth-btn');
    this.zeniDisplay = document.getElementById('user-zeni');
    this.dustDisplay = document.getElementById('user-dust');

    // Auth Modal
    this.authModal = document.getElementById('auth-modal');
    this.authUserInput = document.getElementById('auth-user-input');
    this.authPassInput = document.getElementById('auth-pass-input');
    this.authLoginSubmit = document.getElementById('auth-login-submit');
    this.authRegisterSubmit = document.getElementById('auth-register-submit');
    this.authCloseBtn = document.getElementById('auth-close-btn');

    // Arena — Phase Banner
    this.turnPhaseBar = document.getElementById('turn-phase-bar');
    this.turnPhaseIcon = document.getElementById('turn-phase-icon');
    this.turnPhaseText = document.getElementById('turn-phase-text');

    // Arena — Player HUD
    this.p1Portrait = document.getElementById('p1-portrait');
    this.p1Name = document.getElementById('p1-name');
    this.p1HpFill = document.getElementById('p1-hp-fill');
    this.p1HpText = document.getElementById('p1-hp-text');
    this.p1Shields = document.getElementById('p1-shields');
    this.p1KiSlots = document.getElementById('p1-ki-slots');
    this.p1KiText = document.getElementById('p1-ki-text');
    this.p1LeaderBox = document.getElementById('p1-leader-box');
    this.p1HandContainer = document.getElementById('p1-hand');

    // Arena — Opponent HUD
    this.p2Portrait = document.getElementById('p2-portrait');
    this.p2Name = document.getElementById('p2-name');
    this.p2HpFill = document.getElementById('p2-hp-fill');
    this.p2HpText = document.getElementById('p2-hp-text');
    this.p2Shields = document.getElementById('p2-shields');
    this.p2KiSlots = document.getElementById('p2-ki-slots');
    this.p2KiText = document.getElementById('p2-ki-text');
    this.p2LeaderBox = document.getElementById('p2-leader-box');

    // Arena — Actions
    this.chargeKiBtn = document.getElementById('charge-ki-btn');
    this.passTurnBtn = document.getElementById('pass-turn-btn');
    this.dropZone = document.getElementById('drop-zone');
    this.reactionBanner = document.getElementById('reaction-banner');
    this.timerBarFill = document.getElementById('timer-bar-fill');
    this.reactionText = document.getElementById('reaction-text');

    // Arena — Beam Clash
    this.beamClashOverlay = document.getElementById('beam-clash-overlay');
    this.beamClashFill = document.getElementById('beam-clash-fill');
    this.clashMashBtn = document.getElementById('clash-mash-btn');

    // Arena — Log & KO
    this.battleLogContainer = document.getElementById('battle-log-container');
    this.koModal = document.getElementById('ko-modal');
    this.koText = document.getElementById('ko-text');

    // Other screens
    this.deckListContainer = document.getElementById('deck-list-container');
    this.collectionGrid = document.getElementById('collection-grid');
    this.dojoListContainer = document.getElementById('dojo-list-container');
    this.chatFeed = document.getElementById('chat-feed');
    this.chatInput = document.getElementById('chat-input');
    this.packRevealContainer = document.getElementById('pack-reveal-container');
  }

  /* ── Navigation (Sidebar + Bottom Bar) ──────────────────────────────── */
  bindNavigation() {
    const switchTo = (tabId) => {
      soundEngine.playClick();
      this.switchTab(tabId);
    };

    this.sidebarItems.forEach(btn => {
      btn.addEventListener('click', () => switchTo(btn.dataset.tab));
    });

    this.bottomTabs.forEach(btn => {
      btn.addEventListener('click', () => switchTo(btn.dataset.tab));
    });
  }

  switchTab(tabId) {
    const hideHeaderTabs = ['landing', 'arena'];
    document.body.classList.toggle('hide-header', hideHeaderTabs.includes(tabId));
    document.body.classList.toggle('arena-active', tabId === 'arena');

    this.sidebarItems.forEach(b => b.classList.toggle('active', b.dataset.tab === tabId));
    this.bottomTabs.forEach(b => b.classList.toggle('active', b.dataset.tab === tabId));
    this.screens.forEach(s => {
      s.classList.toggle('active', s.id === `${tabId}-screen`);
    });

    if (tabId === 'deck') this.renderDeckBuilder();
    if (tabId === 'arena' && this.fx) this.fx.resizeCanvas();
  }

  /* ── AAA Console Game Scene System Initialization ───────────────────────── */
  initSceneSystem() {
    // Always start on SPLASH screen every time page loads
    sceneManager.switchScene(GAME_SCENES.SPLASH, { force: true, skipTransition: true, silent: true });

    // 1. Simulated Progress Bar Animation (0% to 100% over 3.2 seconds)
    const fillEl = document.getElementById('splash-loading-fill');
    const textEl = document.getElementById('splash-loading-text');
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.floor(Math.random() * 8) + 4;
      if (progress > 100) progress = 100;

      if (fillEl) fillEl.style.width = `${progress}%`;
      if (textEl) {
        if (progress < 30) textEl.textContent = `CARREGANDO MOTOR DE KI... ${progress}%`;
        else if (progress < 70) textEl.textContent = `INICIALIZANDO BARALHOS E LUTADORES... ${progress}%`;
        else if (progress < 100) textEl.textContent = `PREPARANDO ARENA DE COMBATE... ${progress}%`;
        else textEl.textContent = `PRONTO! ${progress}%`;
      }

      if (progress >= 100) {
        clearInterval(interval);
        setTimeout(() => {
          sceneManager.switchScene(GAME_SCENES.TITLE);
        }, 300);
      }
    }, 100);

    // 2. Press Start AAA Console Button
    document.getElementById('title-press-start-btn')?.addEventListener('click', () => {
      soundEngine.playClick();
      soundEngine.playAwaken();
      sceneManager.switchScene(GAME_SCENES.MAIN_MENU);
    });

    // 3. Cinematic Intro Skip Button
    document.getElementById('intro-skip-btn')?.addEventListener('click', () => {
      soundEngine.playClick();
      sceneManager.switchScene(GAME_SCENES.MAIN_MENU);
    });

    // 4. Main Menu Console Options
    document.getElementById('menu-btn-new-game')?.addEventListener('click', () => {
      soundEngine.playClick();
      sceneManager.switchScene(GAME_SCENES.INTRO);
    });

    document.getElementById('menu-btn-continue')?.addEventListener('click', () => {
      soundEngine.playClick();
      this.multiplayer.startAiMatch(this.selectedLeader, 'vegeta', deckBuilder.getDeckForLeader(this.selectedLeader));
      sceneManager.switchScene(GAME_SCENES.ARENA);
    });

    document.getElementById('menu-btn-select-fighter')?.addEventListener('click', () => {
      soundEngine.playClick();
      sceneManager.switchScene(GAME_SCENES.FIGHTER_SELECT);
    });

    document.getElementById('menu-btn-deck-lab')?.addEventListener('click', () => {
      soundEngine.playClick();
      this.renderDeckBuilder();
      sceneManager.switchScene(GAME_SCENES.DECK_LAB);
    });

    document.getElementById('menu-btn-shop')?.addEventListener('click', () => {
      soundEngine.playClick();
      sceneManager.switchScene(GAME_SCENES.SHOP);
    });

    document.getElementById('menu-btn-settings')?.addEventListener('click', () => {
      soundEngine.playClick();
      document.getElementById('settings-modal')?.classList.add('active');
    });

    document.getElementById('menu-btn-credits')?.addEventListener('click', () => {
      soundEngine.playClick();
      document.getElementById('credits-modal')?.classList.add('active');
    });

    document.getElementById('menu-btn-exit')?.addEventListener('click', () => {
      soundEngine.playClick();
      sceneManager.switchScene(GAME_SCENES.TITLE);
    });

    // Modals Controls
    document.getElementById('close-settings-btn')?.addEventListener('click', () => {
      soundEngine.playClick();
      document.getElementById('settings-modal')?.classList.remove('active');
    });

    document.getElementById('close-credits-btn')?.addEventListener('click', () => {
      soundEngine.playClick();
      document.getElementById('credits-modal')?.classList.remove('active');
    });

    document.getElementById('toggle-audio-btn')?.addEventListener('click', (e) => {
      soundEngine.isMuted = !soundEngine.isMuted;
      e.target.textContent = soundEngine.isMuted ? '🔇 DESLIGADO' : '🔊 LIGADO';
    });

    // 5. Fighter Select Actions & Menu Leader Card Update
    document.getElementById('fs-confirm-btn')?.addEventListener('click', () => {
      soundEngine.playClick();
      this.updateMenuLeaderCard();
      sceneManager.switchScene(GAME_SCENES.MAIN_MENU);
    });

    document.getElementById('fs-back-btn')?.addEventListener('click', () => {
      soundEngine.playClick();
      sceneManager.switchScene(GAME_SCENES.MAIN_MENU);
    });

    // 6. Bottom Arcade Navigation Bar Bindings
    document.getElementById('bnav-home')?.addEventListener('click', () => {
      soundEngine.playClick();
      sceneManager.switchScene(GAME_SCENES.MAIN_MENU);
    });
    document.getElementById('bnav-fighters')?.addEventListener('click', () => {
      soundEngine.playClick();
      sceneManager.switchScene(GAME_SCENES.FIGHTER_SELECT);
    });
    document.getElementById('bnav-deck')?.addEventListener('click', () => {
      soundEngine.playClick();
      this.renderDeckBuilder();
      sceneManager.switchScene(GAME_SCENES.DECK_LAB);
    });
    document.getElementById('bnav-dojos')?.addEventListener('click', () => {
      soundEngine.playClick();
      this.renderDojos();
      sceneManager.switchScene(GAME_SCENES.DOJOS);
    });
    document.getElementById('bnav-chat')?.addEventListener('click', () => {
      soundEngine.playClick();
      this.renderChat();
      sceneManager.switchScene(GAME_SCENES.CHAT);
    });
    document.getElementById('bnav-ranked')?.addEventListener('click', () => {
      soundEngine.playClick();
      sceneManager.switchScene(GAME_SCENES.RANKED);
    });
    document.getElementById('bnav-quests')?.addEventListener('click', () => {
      soundEngine.playClick();
      sceneManager.switchScene(GAME_SCENES.QUESTS);
    });
    document.getElementById('bnav-settings')?.addEventListener('click', () => {
      soundEngine.playClick();
      document.getElementById('settings-modal')?.classList.add('active');
    });

    document.getElementById('deck-back-btn')?.addEventListener('click', () => {
      soundEngine.playClick();
      sceneManager.switchScene(GAME_SCENES.MAIN_MENU);
    });

    document.getElementById('shop-back-btn')?.addEventListener('click', () => {
      soundEngine.playClick();
      sceneManager.switchScene(GAME_SCENES.MAIN_MENU);
    });

    document.getElementById('dojos-back-btn')?.addEventListener('click', () => {
      soundEngine.playClick();
      sceneManager.switchScene(GAME_SCENES.MAIN_MENU);
    });

    document.getElementById('chat-back-btn')?.addEventListener('click', () => {
      soundEngine.playClick();
      sceneManager.switchScene(GAME_SCENES.MAIN_MENU);
    });

    document.getElementById('ranked-back-btn')?.addEventListener('click', () => {
      soundEngine.playClick();
      sceneManager.switchScene(GAME_SCENES.MAIN_MENU);
    });

    document.getElementById('quests-back-btn')?.addEventListener('click', () => {
      soundEngine.playClick();
      sceneManager.switchScene(GAME_SCENES.MAIN_MENU);
    });

    document.getElementById('close-ko-btn')?.addEventListener('click', () => {
      soundEngine.playClick();
      document.getElementById('ko-modal')?.classList.remove('active');
      sceneManager.switchScene(GAME_SCENES.MAIN_MENU);
    });

    this.updateMenuLeaderCard();
  }

  updateMenuLeaderCard() {
    const leaderId = this.selectedLeader || 'goku';
    const leaderObj = LEADERS[leaderId] || LEADERS.goku;
    const slot = document.getElementById('menu-leader-card-slot');
    const cardImgSrc = `assets/leaders/${leaderId}.png`;

    if (slot) {
      slot.innerHTML = `
        <div class="leader-official-card-frame">
          <img src="${cardImgSrc}" alt="${leaderObj.name}" class="leader-official-card-img" onerror="this.src='assets/leaders/goku.png';">
        </div>
      `;
    }
  }

  /* ── Event Bindings ─────────────────────────────────────────────────── */
  bindEvents() {
    if (this.langSwitchBtn) {
      this.langSwitchBtn.addEventListener('click', () => {
        soundEngine.playClick();
        i18n.setLanguage(i18n.lang === 'pt' ? 'en' : 'pt');
        this.applyTranslations();
      });
    }

    this.authBtn?.addEventListener('click', () => {
      soundEngine.playClick();
      if (authDatabase.isLoggedIn() && !authDatabase.getCurrentUser().isGuest) {
        authDatabase.logout();
        this.updateUserSessionUI();
      } else {
        this.authModal?.classList.add('active');
      }
    });
    this.authCloseBtn?.addEventListener('click', () => this.authModal?.classList.remove('active'));
    this.authLoginSubmit?.addEventListener('click', () => {
      const res = authDatabase.login(this.authUserInput?.value || '', this.authPassInput?.value || '');
      alert(res.msg);
      if (res.success) { this.authModal?.classList.remove('active'); this.updateUserSessionUI(); }
    });
    this.authRegisterSubmit?.addEventListener('click', () => {
      const res = authDatabase.register(this.authUserInput?.value || '', this.authPassInput?.value || '');
      alert(res.msg);
      if (res.success) { this.authModal?.classList.remove('active'); this.updateUserSessionUI(); }
    });

    this.chargeKiBtn?.addEventListener('click', () => this.gameEngine.chargeKi('player'));
    this.passTurnBtn?.addEventListener('click', () => {
      soundEngine.playClick();
      this.gameEngine.passTurn('player');
    });
    this.clashMashBtn?.addEventListener('click', () => this.gameEngine.mashBeamClash());

    if (this.dropZone) {
      this.dropZone.addEventListener('dragover', e => {
        e.preventDefault();
        this.dropZone.classList.add('drag-over');
      });
      this.dropZone.addEventListener('dragleave', () => this.dropZone.classList.remove('drag-over'));
      this.dropZone.addEventListener('drop', e => {
        e.preventDefault();
        this.dropZone.classList.remove('drag-over');
        if (this.draggedCardIndex !== null) {
          this.gameEngine.playCard('player', this.draggedCardIndex);
          this.draggedCardIndex = null;
        }
      });
    }

    document.getElementById('buy-pack-btn')?.addEventListener('click', () => {
      const cards = packOpener.openPack();
      if (cards) { this.renderPackReveal(cards); this.updateCurrencies(); this.renderDeckBuilder(); }
    });

    const sendChatMsg = () => {
      if (this.chatInput?.value.trim()) {
        chatManager.addMessage(authDatabase.getCurrentUser().username, this.chatInput.value.trim());
        this.chatInput.value = '';
        this.renderChat();
      }
    };
    document.getElementById('send-chat-btn')?.addEventListener('click', sendChatMsg);
    this.chatInput?.addEventListener('keydown', e => { if (e.key === 'Enter') sendChatMsg(); });

    document.getElementById('close-ko-btn')?.addEventListener('click', () => {
      this.koModal?.classList.remove('active');
      this.switchTab('lobby');
    });

    this.renderDeckBuilder();
    this.renderDojos();
    this.renderChat();
  }

  /* ── User Session ───────────────────────────────────────────────────── */
  updateUserSessionUI() {
    const user = authDatabase.getCurrentUser();
    deckBuilder.zeni = user.zeni;
    deckBuilder.dust = user.dust;
    this.updateCurrencies();
    if (this.authBtn) {
      this.authBtn.textContent = user.isGuest ? '🔑 Entrar' : `👤 ${user.username}`;
    }
  }

  updateCurrencies() {
    if (this.zeniDisplay) this.zeniDisplay.textContent = deckBuilder.zeni;
    if (this.dustDisplay) this.dustDisplay.textContent = deckBuilder.dust;
  }

  /* ── i18n Translations ──────────────────────────────────────────────── */
  applyTranslations() {
    if (this.langSwitchBtn) this.langSwitchBtn.textContent = i18n.lang === 'pt' ? '🇧🇷 PT-BR' : '🇺🇸 EN';

    const $ = id => document.getElementById(id);
    const t = key => i18n.t(key);

    $('landing-title') && ($('landing-title').textContent = t('landingHeroTitle'));
    $('landing-subtitle') && ($('landing-subtitle').textContent = t('landingHeroSubtitle'));
    $('landing-guest-btn') && ($('landing-guest-btn').textContent = t('btnPlayGuest'));
    $('landing-auth-btn') && ($('landing-auth-btn').textContent = t('btnAuthModal'));
    $('landing-enter-arena-btn') && ($('landing-enter-arena-btn').textContent = t('btnEnterArena'));
    $('feat1-title') && ($('feat1-title').textContent = t('feature1Title'));
    $('feat1-desc') && ($('feat1-desc').textContent = t('feature1Desc'));
    $('feat2-title') && ($('feat2-title').textContent = t('feature2Title'));
    $('feat2-desc') && ($('feat2-desc').textContent = t('feature2Desc'));
    $('feat3-title') && ($('feat3-title').textContent = t('feature3Title'));
    $('feat3-desc') && ($('feat3-desc').textContent = t('feature3Desc'));

    $('select-leader-title') && ($('select-leader-title').textContent = t('selectLeaderTitle'));
    $('select-leader-sub') && ($('select-leader-sub').textContent = t('selectLeaderSub'));

    if (this.passTurnBtn) this.passTurnBtn.textContent = t('passTurnBtn');

    this.renderArena(this.gameEngine);
  }

  /* ── Leader Selection Roster ────────────────────────────────────────── */
  renderLeaderSelectionRoster() {
    const picks = document.querySelectorAll('.leader-pick');
    picks.forEach(card => {
      const leaderId = card.dataset.leader;
      const leader = LEADERS[leaderId];
      if (!leader) return;

      const avatar = card.querySelector('.lp-avatar');
      if (avatar) avatar.innerHTML = assetLoader.renderLeaderPortraitHTML(leader);

      const unlocked = characterUnlocks.isUnlocked(leaderId);
      card.classList.toggle('locked', !unlocked);
      let lockBadge = card.querySelector('.lock-badge');
      if (!unlocked && !lockBadge) {
        lockBadge = document.createElement('div');
        lockBadge.className = 'lock-badge';
        lockBadge.style.cssText = 'font-size:0.6rem; color:#ef4444; font-weight:900; margin-top:4px;';
        lockBadge.textContent = `🔒 ${leader.unlockCost} Zeni`;
        card.appendChild(lockBadge);
      } else if (unlocked && lockBadge) {
        lockBadge.remove();
      }

      card.onclick = () => {
        soundEngine.playClick();
        if (!characterUnlocks.isUnlocked(leaderId)) {
          if (confirm(`Unlock ${leader.name} for ${leader.unlockCost} Zeni?`)) {
            characterUnlocks.unlockCharacter(leaderId, leader.unlockCost, deckBuilder.zeni, cost => {
              deckBuilder.zeni -= cost;
              authDatabase.updateProfileStats({ zeni: deckBuilder.zeni });
              this.updateCurrencies();
              this.renderLeaderSelectionRoster();
    this.initDevPanel();
            });
          }
          return;
        }
        picks.forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        this.selectedLeader = leaderId;
        deckBuilder.activeDeck = getStarterDeckForLeader(leaderId);
        this.renderDeckBuilder();
      };
    });
  }

  /* ── Arena Renderer & Active Played Card Display ────────────────────── */
  renderArena(engine) {
    const p = engine.player;
    const opp = engine.opponent;

    // Phase Banner
    if (this.turnPhaseBar) {
      this.turnPhaseBar.className = 'phase-banner';
      if (engine.state === 'ATTACK_PENDING') {
        const defending = engine.pendingAttack?.attackerKey === 'opponent';
        const hasDef = engine.hasDefensiveResponse('player');
        this.turnPhaseBar.classList.add('phase-reaction');
        if (this.turnPhaseIcon) this.turnPhaseIcon.textContent = '⚠️';
        if (this.turnPhaseText) {
          this.turnPhaseText.textContent = defending
            ? (hasDef ? i18n.t('reactionBannerDefending') : i18n.t('reactionBannerNoDef'))
            : i18n.t('reactionBannerInFlight');
        }
      } else if (engine.initiative === 'player') {
        this.turnPhaseBar.classList.add('phase-player');
        if (this.turnPhaseIcon) this.turnPhaseIcon.textContent = '⚔️';
        if (this.turnPhaseText) this.turnPhaseText.textContent = i18n.t('yourTurnBanner');
      } else {
        this.turnPhaseBar.classList.add('phase-opponent');
        if (this.turnPhaseIcon) this.turnPhaseIcon.textContent = '🛡️';
        if (this.turnPhaseText) this.turnPhaseText.textContent = i18n.t('opponentTurnBanner');
      }
    }

    // Player HUD
    this.renderFighterHUD('p1', p);
    // Opponent HUD
    this.renderFighterHUD('p2', opp);

    // Action buttons
    const canAct = engine.state === 'FREE_ACTION' && engine.initiative === 'player';
    if (this.chargeKiBtn) {
      this.chargeKiBtn.disabled = !canAct;
      this.chargeKiBtn.classList.toggle('overcharge', p.ki >= 10);
      this.chargeKiBtn.innerHTML = p.ki >= 10 ? i18n.t('overchargeKiBtn') : i18n.t('chargeKiBtn');
    }
    if (this.passTurnBtn) {
      this.passTurnBtn.disabled = !canAct;
      this.passTurnBtn.textContent = i18n.t('passTurnBtn');
    }

    // Central Drop Zone — Transparent Center Field with Minimal Action Badge & Large Played Card
    if (this.dropZone) {
      if (engine.pendingAttack) {
        const attackerName = engine.pendingAttack.attackerKey === 'player' ? p.name : opp.name;
        const attackCard = engine.pendingAttack.card;
        const actionTypeIcon = attackCard.type === 'attack' ? '⚔️' : (attackCard.type === 'evade' ? '💨' : '🛡️');

        this.dropZone.innerHTML = `
          <div class="minimal-action-badge">
            <span class="mab-icon">${actionTypeIcon}</span>
            <span class="mab-text">${attackCard.name.toUpperCase()} — ${attackerName.toUpperCase()}</span>
          </div>
          <div class="played-card-slot">
            <div class="card type-${attackCard.type}${attackCard.rarity === 'super-rare' ? ' super-rare' : ''}">
              ${assetLoader.renderCardArtHTML(attackCard)}
              <div class="card-header"><div class="card-ki-cost">${attackCard.cost}</div></div>
              <div class="card-title">${attackCard.name.toUpperCase()}</div>
              <div class="card-type-tag tag-${attackCard.type}">${attackCard.type.toUpperCase()}</div>
              ${attackCard.power > 0 ? `<div class="card-power-badge">${attackCard.power} ATK</div>` : ''}
            </div>
          </div>
        `;
      } else {
        this.dropZone.innerHTML = '';
      }
    }

    // Reaction banner
    if (engine.state === 'ATTACK_PENDING') {
      this.reactionBanner?.classList.add('active');
    } else {
      this.reactionBanner?.classList.remove('active');
    }

    // Beam Clash
    if (engine.state === 'BEAM_CLASH' && engine.beamClash.active) {
      this.beamClashOverlay?.classList.add('active');
      if (this.beamClashFill) this.beamClashFill.style.width = `${engine.beamClash.playerClicks}%`;
    } else {
      this.beamClashOverlay?.classList.remove('active');
    }

        // Beam Clash Button & Overlay
    const mashBtn = document.getElementById('clash-mash-btn');
    if (mashBtn) {
      mashBtn.style.display = engine.state === 'BEAM_CLASH' ? 'inline-block' : 'none';
    }

    // Hand
    this.renderPlayerHand(p.hand, p.ki, engine.state, engine.initiative, engine.pendingAttack, p.isOpenGuard);

    // Logs
    this.renderLogs(engine.battleLogs);

    // Game Over
    if (engine.state === 'GAME_OVER') {
      this.koModal?.classList.add('active');
      if (this.koText) {
        if (engine.winner === 'player') {
          soundEngine.playAwaken();
          this.koText.textContent = i18n.t('victoryTitle');
        } else {
          this.koText.textContent = i18n.t('defeatTitle');
        }
      }
    }
  }

  renderFighterHUD(prefix, fighter) {
    const portrait = document.getElementById(`${prefix}-portrait`);
    const name = document.getElementById(`${prefix}-name`);
    const hpFill = document.getElementById(`${prefix}-hp-fill`);
    const hpText = document.getElementById(`${prefix}-hp-text`);
    const shields = document.getElementById(`${prefix}-shields`);
    const kiSlots = document.getElementById(`${prefix}-ki-slots`);
    const kiText = document.getElementById(`${prefix}-ki-text`);
    const leaderBox = document.getElementById(`${prefix}-leader-box`);

    if (name) name.innerHTML = `${fighter.isAwakened ? fighter.leader.awakenedName : fighter.leader.name} <span class="awaken-badge">AWAKENED</span>`;

    if (hpFill) {
      const pct = Math.max(0, (fighter.hp / fighter.maxHp) * 100);
      hpFill.style.width = `${pct}%`;
      hpFill.className = 'hp-bar-fill';
      if (pct <= 25) hpFill.classList.add('hp-low');
      else if (pct <= 50) hpFill.classList.add('hp-mid');
    }
    if (hpText) hpText.textContent = `${fighter.hp}/${fighter.maxHp} HP`;

    if (portrait) {
      portrait.innerHTML = assetLoader.renderLeaderPortraitHTML(fighter.leader);
      portrait.classList.toggle('awakened', fighter.isAwakened);
    }

    this.renderFighterCanvas(prefix, fighter);

    this.renderShields(shields, fighter.shields);
    this.renderKiGauge(kiSlots, kiText, fighter.ki);
    if (leaderBox) leaderBox.classList.toggle('open-guard', fighter.isOpenGuard);
  }

  startFighterSpriteLoop() {
    setInterval(() => {
      if (this.gameEngine) {
        this.renderFighterCanvas('p1', this.gameEngine.player);
        this.renderFighterCanvas('p2', this.gameEngine.opponent);
      }
    }, 130);
  }

  renderFighterCanvas(prefix, fighter) {
    if (!fighter || !fighter.leader) return;
    const canvas = document.getElementById(`${prefix}-fighter-canvas`);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const leaderId = (fighter.leader.id || 'goku').toLowerCase();
    const validLeaders = ['goku', 'vegeta', 'gohan', 'frieza', 'piccolo', 'trunks'];
    const charName = validLeaders.includes(leaderId) ? leaderId : 'goku';
    const sheetUrl = `assets/spritesheets/characters/${charName}_sheet.png`;

    const sheetKey = `char_${charName}`;
    const sheet = spriteEngine.loadSheet(sheetKey, sheetUrl, 64, 64, 12);

    if (!this[`_${prefix}State`]) {
      this[`_${prefix}State`] = { sheetKey, frame: 0 };
    }
    const state = this[`_${prefix}State`];
    if (state.sheetKey !== sheetKey) {
      state.sheetKey = sheetKey;
      state.frame = 0;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = false;

    if (sheet.loaded) {
      const fw = 64;
      const fh = 64;
      const isP2 = prefix === 'p2';

      ctx.save();
      ctx.translate(canvas.width / 2, canvas.height / 2);
      if (isP2) ctx.scale(-1, 1);
      ctx.drawImage(sheet.image, state.frame * fw, 0, fw, fh, -fw, -fh, fw * 2, fh * 2);
      ctx.restore();

      state.frame = (state.frame + 1) % 4; // Idle breathing loop (frames 0..3)
    }
  }

  renderShields(container, count) {
    if (!container) return;
    container.innerHTML = '';
    for (let i = 0; i < 8; i++) {
      const pip = document.createElement('div');
      pip.className = `shield-pip${i >= count ? ' broken' : ''}`;
      container.appendChild(pip);
    }
  }

  renderKiGauge(container, textEl, ki) {
    if (container) {
      container.innerHTML = '';
      for (let i = 0; i < 10; i++) {
        const pip = document.createElement('div');
        pip.className = `ki-pip${i < ki ? ' filled' : ''}`;
        container.appendChild(pip);
      }
    }
    if (textEl) textEl.textContent = `${ki}/10 KI`;
  }

  /* ── Player Hand & Touch Gesture Slide Pop-up ──────────────────────── */
  renderPlayerHand(hand, playerKi, gameState, initiative, pendingAttack, isOpenGuard) {
    if (!this.p1HandContainer) return;
    this.p1HandContainer.innerHTML = '';

    hand.forEach((card, index) => {
      const el = document.createElement('div');

      let isPlayable = false;
      let reasonText = '';

      if (playerKi < card.cost) {
        reasonText = i18n.t('reasonNeedKi');
      } else if (card.type === 'evade' && isOpenGuard) {
        reasonText = i18n.t('reasonOpenGuard');
      } else if (gameState === 'FREE_ACTION' && initiative === 'player') {
        if (card.type === 'attack' || card.type === 'tech') isPlayable = true;
        else reasonText = i18n.t('reasonDefenseOnly');
      } else if (gameState === 'ATTACK_PENDING' && pendingAttack) {
        if (pendingAttack.attackerKey === 'opponent') {
          if (['defense', 'evade', 'counter'].includes(card.type) || card.isBeam) isPlayable = true;
          else reasonText = i18n.t('reasonReactionOnly');
        } else {
          reasonText = i18n.t('reasonInFlight');
        }
      } else if (initiative !== 'player') {
        reasonText = i18n.t('reasonOpponentTurn');
      }

      el.className = `card type-${card.type}${card.rarity === 'super-rare' ? ' super-rare' : ''} ${isPlayable ? 'playable' : 'unplayable'}`;

      el.innerHTML = `
        ${assetLoader.renderCardArtHTML(card)}
        <div class="card-header"><div class="card-ki-cost">${card.cost}</div></div>
        <div class="card-type-tag tag-${card.type}">${card.type.toUpperCase()}</div>
        
        ${card.power > 0 ? `<div class="card-power-badge">${card.power} ATK</div>` : ''}
      `;

      el.draggable = isPlayable;
      el.addEventListener('dragstart', () => { this.draggedCardIndex = index; });

      // Touchscreen Mobile Slide Pop-up Gesture
      el.addEventListener('touchstart', () => {
        if (isPlayable) this.draggedCardIndex = index;
        el.classList.add('touch-hover');
      }, { passive: true });

      el.addEventListener('touchmove', (e) => {
        if (e.touches && e.touches[0]) {
          const touch = e.touches[0];
          const targetEl = document.elementFromPoint(touch.clientX, touch.clientY);
          const parentCard = targetEl ? targetEl.closest('.card') : null;
          
          this.p1HandContainer.querySelectorAll('.card').forEach(c => {
            if (c === parentCard) c.classList.add('touch-hover');
            else c.classList.remove('touch-hover');
          });
        }
      }, { passive: true });

      const clearTouchHover = () => {
        this.p1HandContainer.querySelectorAll('.card').forEach(c => c.classList.remove('touch-hover'));
      };
      el.addEventListener('touchend', clearTouchHover);
      el.addEventListener('touchcancel', clearTouchHover);

      el.addEventListener('click', () => {
        if (isPlayable) {
          soundEngine.playClick();
          soundEngine.playCardPlay(); this.gameEngine.playCard('player', index);
        }
      });

      this.p1HandContainer.appendChild(el);
    });
  }

  /* ── Battle Log ─────────────────────────────────────────────────────── */
  renderLogs(logs) {
    if (!this.battleLogContainer) return;
    this.battleLogContainer.innerHTML = '';
    logs.slice(0, 8).forEach(log => {
      const line = document.createElement('div');
      line.className = `log-line ${log.type || ''}`;
      const timeStr = log.timestamp || log.time || '';
      const textStr = log.text || log.msg || '';
      line.textContent = timeStr ? `[${timeStr}] ${textStr}` : textStr;
      this.battleLogContainer.appendChild(line);
    });
  }

  /* ── Deck Builder & Card Inspect Trigger ───────────────────────────── */
    renderDeckBuilder() {
    const container = document.getElementById('deck-builder-container');
    if (container) {
      deckBuilder.render('deck-builder-container');
      return;
    }

    if (this.deckListContainer) {
      this.deckListContainer.innerHTML = '';
      const deck = deckBuilder.getDeckForLeader(this.selectedLeader);
      deck.forEach((cardId, index) => {
        const card = getCardById(cardId);
        if (!card) return;
        const row = document.createElement('div');
        row.className = 'deck-entry';
        row.style.cssText = 'cursor:pointer; display:flex; justify-content:space-between; align-items:center; padding:8px 12px; background:rgba(255,255,255,0.04); border-radius:6px; margin-bottom:6px; border:1px solid rgba(255,255,255,0.1); color:#fff; font-size:0.8rem; font-weight:700;';
        row.innerHTML = `
          <span class="de-title" style="display:flex; align-items:center; gap:6px;">
            <span style="color:var(--ki-yellow);">${card.cost} Ki</span>
            <span>${card.name}</span>
          </span>
          <button class="de-remove" style="background:none; border:none; color:#ef4444; font-weight:900; font-size:0.9rem; cursor:pointer;">✕</button>
        `;
        row.querySelector('.de-title').onclick = () => this.openCardInspectModal(card);
        row.querySelector('.de-remove').onclick = (e) => {
          e.stopPropagation();
          deckBuilder.removeCardFromDeck(index, this.selectedLeader);
          this.renderDeckBuilder();
        };
        this.deckListContainer.appendChild(row);
      });
    }

    if (this.collectionGrid) {
      this.collectionGrid.innerHTML = '';
      CARD_DATABASE.forEach(card => {
        const el = document.createElement('div');
        el.className = `card type-${card.type}${card.rarity === 'super-rare' ? ' super-rare' : ''}`;
        el.style.cursor = 'pointer';
        el.innerHTML = `
          ${assetLoader.renderCardArtHTML(card)}
          <div class="card-header"><div class="card-ki-cost">${card.cost}</div></div>
          <div class="card-type-tag tag-${card.type}">${card.type.toUpperCase()}</div>
          ${card.power > 0 ? `<div class="card-power-badge">${card.power} ATK</div>` : ''}
        `;
        el.onclick = () => {
          deckBuilder.addCardToDeck(card.id, this.selectedLeader);
          this.renderDeckBuilder();
        };
        this.collectionGrid.appendChild(el);
      });
    }
  }

  renderDojos() {
    if (!this.dojoListContainer) return;
    this.dojoListContainer.innerHTML = '';
    const medals = ['🥇', '🥈', '🥉'];
    DOJO_RANKINGS.forEach((dojo, i) => {
      const row = document.createElement('div');
      row.className = 'dojo-row';
      row.innerHTML = `
        <div style="display:flex;align-items:center;gap:10px;">
          <span class="dojo-rank">${medals[i] || `#${i + 1}`}</span>
          <span>${dojo.icon} ${dojo.name} <span style="color:var(--text-dim)">(${dojo.leader})</span></span>
        </div>
        <span class="dojo-power">${dojo.power} PWR</span>
      `;
      this.dojoListContainer.appendChild(row);
    });
  }

  /* ── Chat ────────────────────────────────────────────────────────────── */
  renderChat() {
    if (!this.chatFeed) return;
    this.chatFeed.innerHTML = '';
    chatManager.messages.forEach(msg => {
      const bubble = document.createElement('div');
      bubble.className = 'chat-bubble';
      bubble.innerHTML = `<span class="cb-user">${msg.user}</span><span class="cb-time">${msg.time}</span><br>${msg.text}`;
      this.chatFeed.appendChild(bubble);
    });
    this.chatFeed.scrollTop = this.chatFeed.scrollHeight;
  }

  /* ── Pack Reveal ────────────────────────────────────────────────────── */
  renderPackReveal(cards) {
    if (!this.packRevealContainer) return;
    this.packRevealContainer.innerHTML = '';
    cards.forEach(card => {
      const el = document.createElement('div');
      el.className = `card type-${card.type}${card.rarity === 'super-rare' ? ' super-rare' : ''}`;
      el.style.cursor = 'pointer';
      el.innerHTML = `
        ${assetLoader.renderCardArtHTML(card)}
        <div class="card-header"><div class="card-ki-cost">${card.cost}</div></div>
        <div class="card-type-tag tag-${card.type}">${card.type.toUpperCase()}</div>
        ${card.power > 0 ? `<div class="card-power-badge">${card.power} ATK</div>` : ''}
      `;
      el.onclick = () => this.openCardInspectModal(card);
      this.packRevealContainer.appendChild(el);
    });
  }

  /* ── DEV ADMIN PANEL CONTROLLER ────────────────────────────────────── */
  initDevPanel() {
    const modal = document.getElementById('dev-panel-modal');
    const openBtn = document.getElementById('open-dev-panel-btn');
    const closeBtn = document.getElementById('close-dev-modal-btn');
    const exportBtn = document.getElementById('dev-export-btn');
    const importBtn = document.getElementById('dev-import-btn');
    const resetAllBtn = document.getElementById('dev-reset-all-btn');
    const fileInput = document.getElementById('dev-import-file-input');

    if (openBtn) openBtn.onclick = () => { soundEngine.playClick(); this.openDevPanel(); };
    if (closeBtn) closeBtn.onclick = () => modal?.classList.remove('active');

    window.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        soundEngine.playClick();
        this.openDevPanel();
      }
    });

    if (exportBtn) {
      exportBtn.onclick = () => {
        const exports = {};
        CARD_DATABASE.forEach(c => {
          const custom = localStorage.getItem(`dbtcg_custom_card_${c.id}`);
          if (custom) exports[c.id] = custom;
        });
        const blob = new Blob([JSON.stringify(exports, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'dbtcg_custom_cards_backup.json';
        a.click();
      };
    }

    if (importBtn && fileInput) {
      importBtn.onclick = () => fileInput.click();
      fileInput.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
          try {
            const data = JSON.parse(evt.target.result);
            Object.keys(data).forEach(id => {
              localStorage.setItem(`dbtcg_custom_card_${id}`, data[id]);
            });
            alert('Custom cards backup imported successfully!');
            this.renderDevPanel();
            this.renderDeckBuilder();
          } catch (err) {
            alert('Invalid backup JSON file.');
          }
        };
        reader.readAsText(file);
      };
    }

    if (resetAllBtn) {
      resetAllBtn.onclick = () => {
        if (confirm('Restaurar todas as artes de cartas para o padrão?')) {
          CARD_DATABASE.forEach(c => localStorage.removeItem(`dbtcg_custom_card_${c.id}`));
          this.renderDevPanel();
          this.renderDeckBuilder();
        }
      };
    }
  }

  openDevPanel() {
    const modal = document.getElementById('dev-panel-modal');
    if (!modal) return;
    modal.classList.add('active');
    this.renderDevPanel();
  }

  renderDevPanel() {
    const grid = document.getElementById('dev-card-list-grid');
    if (!grid) return;
    grid.innerHTML = '';

    CARD_DATABASE.forEach(card => {
      const cardBox = document.createElement('div');
      cardBox.style.cssText = 'background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.12); border-radius: 8px; padding: 10px; display: flex; gap: 10px; align-items: center;';

      const imgSrc = assetLoader.getCardImagePath(card.id);
      const isCustom = !!localStorage.getItem(`dbtcg_custom_card_${card.id}`);

      cardBox.innerHTML = `
        <div style="width: 50px; height: 70px; border-radius: 4px; overflow: hidden; background: #000; flex-shrink: 0; position: relative;">
          <img src="${imgSrc}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.style.display='none';">
          ${isCustom ? '<span style="position:absolute; top:2px; right:2px; font-size:0.5rem; background:#10b981; color:#000; padding:1px 3px; font-weight:900; border-radius:2px;">CUSTOM</span>' : ''}
        </div>
        <div style="flex-grow: 1; overflow: hidden;">
          <div style="font-weight: 800; font-size: 0.8rem; color: #ffd700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${card.name}</div>
          <div style="font-size: 0.65rem; color: #9ca3af; margin-bottom: 6px;">ID: ${card.id} | ${card.cost} Ki | ${card.type.toUpperCase()}</div>
          <div style="display: flex; gap: 6px;">
            <label class="btn-ghost" style="font-size: 0.65rem; padding: 3px 8px; cursor: pointer; border-color: #ffd700; color: #ffd700;">
              📁 Upload PNG
              <input type="file" accept="image/*" class="dev-card-file-input" data-card="${card.id}" style="display: none;">
            </label>
            ${isCustom ? `<button class="btn-ghost dev-reset-card-btn" data-card="${card.id}" style="font-size: 0.65rem; padding: 3px 8px; border-color: #ef4444; color: #ef4444;">Restaurar</button>` : ''}
          </div>
        </div>
      `;

      const input = cardBox.querySelector('.dev-card-file-input');
      if (input) {
        input.onchange = (e) => {
          const file = e.target.files[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = (evt) => {
            localStorage.setItem(`dbtcg_custom_card_${card.id}`, evt.target.result);
            soundEngine.playClick();
            this.renderDevPanel();
            this.renderDeckBuilder();
          };
          reader.readAsDataURL(file);
        };
      }

      const resetBtn = cardBox.querySelector('.dev-reset-card-btn');
      if (resetBtn) {
        resetBtn.onclick = () => {
          localStorage.removeItem(`dbtcg_custom_card_${card.id}`);
          soundEngine.playClick();
          this.renderDevPanel();
          this.renderDeckBuilder();
        };
      }

      grid.appendChild(cardBox);
    });
  }
}
=======
/* ==========================================================================
   Dragon Ball Clash Action TCG — UI Manager (Redesigned Layout Engine)
   Anime action indicators, opponent played card display, touch gesture popups,
   Card Inspect Modal & Full PT-BR/EN i18n support
   ========================================================================== */

import { GameEngine } from './game-engine.js';
import { MultiplayerManager } from './multiplayer-manager.js';
import { deckBuilder } from './deck-builder.js';
import { packOpener } from './pack-opener.js';
import { chatManager, DOJO_RANKINGS } from './chat-manager.js';
import { FXEngine } from './fx-engine.js';
import { TutorialManager } from './tutorial-manager.js';
import { characterUnlocks } from './character-unlocks.js';
import { assetLoader } from './asset-loader.js';
import { cutsceneEngine } from './cutscene-engine.js';
import { soundEngine } from './audio.js';
import { getCardById, LEADERS, getStarterDeckForLeader, CARD_DATABASE } from './card-database.js';
import { authDatabase } from './auth-database.js';
import { i18n } from './i18n.js';

export class UIManager {
  constructor() {
    this.fx = new FXEngine('fx-canvas');

    this.gameEngine = new GameEngine(
      this.renderArena.bind(this),
      this.handleFXEvent.bind(this)
    );

    this.gameEngine.onTimerTick = (secondsLeft, maxSec = 3.0) => {
      if (this.timerBarFill) {
        const pct = (secondsLeft / maxSec) * 100;
        this.timerBarFill.style.width = `${Math.max(0, pct)}%`;
      }
    };

    this.multiplayer = new MultiplayerManager(this.gameEngine);
    this.tutorial = new TutorialManager(this);

    this.selectedLeader = 'goku';
    this.draggedCardIndex = null;
    this.actionBannerTimer = null;

    this.initDOM();
    this.initCardInspectModal();
    this.bindNavigation();
    this.bindEvents();
    this.updateUserSessionUI();
    this.applyTranslations();
    this.renderLeaderSelectionRoster();
    this.initDevPanel();
  }


  triggerScreenShake() {
    const screen = document.getElementById('arena-screen');
    if (!screen) return;
    screen.classList.remove('shake-screen');
    void screen.offsetWidth;
    screen.classList.add('shake-screen');
    setTimeout(() => screen.classList.remove('shake-screen'), 400);
  }

  triggerFloatingDamage(x, y, text) {
    const el = document.createElement('div');
    el.className = 'floating-damage-popup';
    el.textContent = text;
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    document.getElementById('arena-screen')?.appendChild(el);
    setTimeout(() => el.remove(), 850);
  }

  /* ── Anime Action Splash Banner ────────────────────────────────────── */
  triggerActionBanner(text, actClass = 'act-attack') {
    let banner = document.getElementById('anime-action-banner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'anime-action-banner';
      banner.className = 'anime-action-banner';
      document.getElementById('arena-screen')?.appendChild(banner);
    }
    banner.textContent = text;
    banner.className = `anime-action-banner ${actClass} active`;
    if (this.actionBannerTimer) clearTimeout(this.actionBannerTimer);
    this.actionBannerTimer = setTimeout(() => {
      banner.classList.remove('active');
    }, 1100);
  }

  /* ── FX Event Handler ──────────────────────────────────────────────── */
  handleFXEvent(type, data = {}) {
    if (!this.fx) return;
    if (type === 'kiAura') {
      soundEngine.playKiCharge();
      this.triggerActionBanner('⚡ CARREGAR KI! (+2 KI)', 'act-charge');
      this.fx.spawnKiAura(data.x || 300, data.y || 400, data.color);
    } else if (type === 'beamClash') {
      soundEngine.playBeamBlast();
      this.triggerScreenShake();
      this.triggerActionBanner('⚡ BEAM CLASH TUG-OF-WAR!', 'act-attack');
      this.fx.triggerBeamClash(data.p1Progress, data.p1Color, data.p2Color);
    } else if (type === 'kamehameha') {
      soundEngine.playBeamBlast();
      this.triggerScreenShake();
      this.triggerActionBanner('🔥 KAMEHAMEHA DISPARADO!', 'act-attack');
      this.triggerFloatingDamage(data.toX || 900, data.toY || 200, '-40 HP');
      const attackerKey = this.gameEngine.pendingAttack ? this.gameEngine.pendingAttack.attackerKey : 'player';
      const leader = attackerKey === 'player' ? this.gameEngine.player.leader : this.gameEngine.opponent.leader;
      cutsceneEngine.triggerCutscene(leader.icon, 'KAMEHAMEHA!', leader.quote, leader.color, 1000);
      this.fx.fireKamehameha(data.fromX || 300, data.fromY || 300, data.toX || 900, data.toY || 300, data.isGolden);
    } else if (type === 'punch') {
      soundEngine.playPunch();
      this.triggerScreenShake();
      this.triggerActionBanner('💥 IMPACTO DIRETO!', 'act-attack');
      this.triggerFloatingDamage(data.x || 500, data.y || 250, '-25 HP');
      this.fx.triggerImpactHit(data.x || 500, data.y || 250);
    } else if (type === 'zvanish') {
      soundEngine.playZVanish();
      this.triggerActionBanner('💨 Z-VANISH TELEPORT!', 'act-evade');
      this.fx.triggerZVanish(data.x || 500, data.y || 250, data.color);
    } else if (type === 'awaken') {
      soundEngine.playAwaken();
      this.triggerScreenShake();
      this.triggerActionBanner('🔥 AWAKEN TRANSFORMAÇÃO!', 'act-charge');
      cutsceneEngine.triggerCutscene('🔥', 'AWAKEN TRANSFORMATION!', 'THIS IS MY TRUE POWER!', '#ffd700', 1000);
      this.fx.triggerAwakenBurst(data.x || 500, data.color);
    }
  }

  /* ── Card Inspect Modal Handler ────────────────────────────────────── */
  initCardInspectModal() {
    this.cardInspectModal = document.getElementById('card-inspect-modal');
    this.cardInspectClose = document.getElementById('card-inspect-close');
    
    if (this.cardInspectClose) {
      this.cardInspectClose.addEventListener('click', () => {
        this.cardInspectModal?.classList.remove('active');
      });
    }
    this.cardInspectModal?.addEventListener('click', (e) => {
      if (e.target === this.cardInspectModal) {
        this.cardInspectModal.classList.remove('active');
      }
    });
  }

  openCardInspectModal(card) {
    if (!card || !this.cardInspectModal) return;
    soundEngine.playClick();
    
    const preview = document.getElementById('card-inspect-preview');
    const nameEl = document.getElementById('inspect-card-name');
    const typeEl = document.getElementById('inspect-card-type');
    const descEl = document.getElementById('inspect-card-desc');
    const costEl = document.getElementById('inspect-card-cost');
    const powerEl = document.getElementById('inspect-card-power');

    if (preview) {
      preview.innerHTML = `
        <div class="card type-${card.type}${card.rarity === 'super-rare' ? ' super-rare' : ''}">
          ${assetLoader.renderCardArtHTML(card)}
          <div class="card-header"><div class="card-ki-cost">${card.cost}</div></div>
          <div class="card-type-tag tag-${card.type}">${card.type.toUpperCase()}</div>
          ${card.power > 0 ? `<div class="card-power-badge">${card.power} ATK</div>` : ''}
        </div>
      `;
    }

    if (nameEl) nameEl.textContent = card.name;
    if (typeEl) {
      typeEl.textContent = `${card.rarity.toUpperCase()} — ${card.type.toUpperCase()}`;
      typeEl.className = `inspect-type-badge tag-${card.type}`;
    }
    if (descEl) descEl.textContent = i18n.lang === 'pt' ? (card.descPt || card.description) : (card.descEn || card.description);
    if (costEl) costEl.textContent = `⚡ Ki Cost: ${card.cost}`;
    if (powerEl) powerEl.textContent = card.power > 0 ? `💥 Power: ${card.power} ATK` : '🛡️ Special Skill';

    this.cardInspectModal.classList.add('active');
  }

  /* ── DOM References ────────────────────────────────────────────────── */
  initDOM() {
    // Navigation
    this.sidebarItems = document.querySelectorAll('#sidebar .nav-item');
    this.bottomTabs = document.querySelectorAll('#bottom-bar .btab');
    this.screens = document.querySelectorAll('.screen');

    // Header
    this.langSwitchBtn = document.getElementById('lang-switch-btn');
    this.authBtn = document.getElementById('auth-btn');
    this.zeniDisplay = document.getElementById('user-zeni');
    this.dustDisplay = document.getElementById('user-dust');

    // Auth Modal
    this.authModal = document.getElementById('auth-modal');
    this.authUserInput = document.getElementById('auth-user-input');
    this.authPassInput = document.getElementById('auth-pass-input');
    this.authLoginSubmit = document.getElementById('auth-login-submit');
    this.authRegisterSubmit = document.getElementById('auth-register-submit');
    this.authCloseBtn = document.getElementById('auth-close-btn');

    // Arena — Phase Banner
    this.turnPhaseBar = document.getElementById('turn-phase-bar');
    this.turnPhaseIcon = document.getElementById('turn-phase-icon');
    this.turnPhaseText = document.getElementById('turn-phase-text');

    // Arena — Player HUD
    this.p1Portrait = document.getElementById('p1-portrait');
    this.p1Name = document.getElementById('p1-name');
    this.p1HpFill = document.getElementById('p1-hp-fill');
    this.p1HpText = document.getElementById('p1-hp-text');
    this.p1Shields = document.getElementById('p1-shields');
    this.p1KiSlots = document.getElementById('p1-ki-slots');
    this.p1KiText = document.getElementById('p1-ki-text');
    this.p1LeaderBox = document.getElementById('p1-leader-box');
    this.p1HandContainer = document.getElementById('p1-hand');

    // Arena — Opponent HUD
    this.p2Portrait = document.getElementById('p2-portrait');
    this.p2Name = document.getElementById('p2-name');
    this.p2HpFill = document.getElementById('p2-hp-fill');
    this.p2HpText = document.getElementById('p2-hp-text');
    this.p2Shields = document.getElementById('p2-shields');
    this.p2KiSlots = document.getElementById('p2-ki-slots');
    this.p2KiText = document.getElementById('p2-ki-text');
    this.p2LeaderBox = document.getElementById('p2-leader-box');

    // Arena — Actions
    this.chargeKiBtn = document.getElementById('charge-ki-btn');
    this.passTurnBtn = document.getElementById('pass-turn-btn');
    this.dropZone = document.getElementById('drop-zone');
    this.reactionBanner = document.getElementById('reaction-banner');
    this.timerBarFill = document.getElementById('timer-bar-fill');
    this.reactionText = document.getElementById('reaction-text');

    // Arena — Beam Clash
    this.beamClashOverlay = document.getElementById('beam-clash-overlay');
    this.beamClashFill = document.getElementById('beam-clash-fill');
    this.clashMashBtn = document.getElementById('clash-mash-btn');

    // Arena — Log & KO
    this.battleLogContainer = document.getElementById('battle-log-container');
    this.koModal = document.getElementById('ko-modal');
    this.koText = document.getElementById('ko-text');

    // Other screens
    this.deckListContainer = document.getElementById('deck-list-container');
    this.collectionGrid = document.getElementById('collection-grid');
    this.dojoListContainer = document.getElementById('dojo-list-container');
    this.chatFeed = document.getElementById('chat-feed');
    this.chatInput = document.getElementById('chat-input');
    this.packRevealContainer = document.getElementById('pack-reveal-container');
  }

  /* ── Navigation (Sidebar + Bottom Bar) ──────────────────────────────── */
  bindNavigation() {
    const switchTo = (tabId) => {
      soundEngine.playClick();
      this.switchTab(tabId);
    };

    this.sidebarItems.forEach(btn => {
      btn.addEventListener('click', () => switchTo(btn.dataset.tab));
    });

    this.bottomTabs.forEach(btn => {
      btn.addEventListener('click', () => switchTo(btn.dataset.tab));
    });
  }

  switchTab(tabId) {
    const hideHeaderTabs = ['landing', 'arena'];
    document.body.classList.toggle('hide-header', hideHeaderTabs.includes(tabId));
    document.body.classList.toggle('arena-active', tabId === 'arena');

    this.sidebarItems.forEach(b => b.classList.toggle('active', b.dataset.tab === tabId));
    this.bottomTabs.forEach(b => b.classList.toggle('active', b.dataset.tab === tabId));
    this.screens.forEach(s => {
      s.classList.toggle('active', s.id === `${tabId}-screen`);
    });

    if (tabId === 'deck') this.renderDeckBuilder();
    if (tabId === 'arena' && this.fx) this.fx.resizeCanvas();
  }

  /* ── Event Bindings ─────────────────────────────────────────────────── */
  bindEvents() {
    if (this.langSwitchBtn) {
      this.langSwitchBtn.addEventListener('click', () => {
        soundEngine.playClick();
        i18n.setLanguage(i18n.lang === 'pt' ? 'en' : 'pt');
        this.applyTranslations();
      });
    }

    document.getElementById('landing-enter-arena-btn')?.addEventListener('click', () => {
      soundEngine.playClick();
      this.switchTab('lobby');
    });
    document.getElementById('landing-guest-btn')?.addEventListener('click', () => {
      soundEngine.playClick();
      authDatabase.loginAsGuest();
      this.updateUserSessionUI();
      this.switchTab('lobby');
    });
    document.getElementById('landing-auth-btn')?.addEventListener('click', () => {
      soundEngine.playClick();
      this.authModal?.classList.add('active');
    });

    this.authBtn?.addEventListener('click', () => {
      soundEngine.playClick();
      if (authDatabase.isLoggedIn() && !authDatabase.getCurrentUser().isGuest) {
        authDatabase.logout();
        this.updateUserSessionUI();
      } else {
        this.authModal?.classList.add('active');
      }
    });
    this.authCloseBtn?.addEventListener('click', () => this.authModal?.classList.remove('active'));
    this.authLoginSubmit?.addEventListener('click', () => {
      const res = authDatabase.login(this.authUserInput?.value || '', this.authPassInput?.value || '');
      alert(res.msg);
      if (res.success) { this.authModal?.classList.remove('active'); this.updateUserSessionUI(); }
    });
    this.authRegisterSubmit?.addEventListener('click', () => {
      const res = authDatabase.register(this.authUserInput?.value || '', this.authPassInput?.value || '');
      alert(res.msg);
      if (res.success) { this.authModal?.classList.remove('active'); this.updateUserSessionUI(); }
    });

    document.getElementById('start-tutorial-btn')?.addEventListener('click', () => this.tutorial.startTutorial());
    document.getElementById('start-vs-ai-btn')?.addEventListener('click', () => {
      soundEngine.playClick();
      this.multiplayer.startAiMatch(this.selectedLeader, 'vegeta', deckBuilder.getDeckForLeader(this.selectedLeader));
      this.switchTab('arena');
    });
    document.getElementById('create-room-btn')?.addEventListener('click', () => {
      soundEngine.playClick();
      const code = this.multiplayer.createRoom(this.selectedLeader, deckBuilder.getDeckForLeader(this.selectedLeader));
      alert(`Room Created! Share Code: ${code}`);
      this.switchTab('arena');
    });
    document.getElementById('join-room-btn')?.addEventListener('click', () => {
      const code = prompt("Enter 4-Digit Room Code:");
      if (code) {
        soundEngine.playClick();
        this.multiplayer.joinRoom(code, this.selectedLeader, deckBuilder.getDeckForLeader(this.selectedLeader));
        this.switchTab('arena');
      }
    });

    this.chargeKiBtn?.addEventListener('click', () => this.gameEngine.chargeKi('player'));
    this.passTurnBtn?.addEventListener('click', () => {
      soundEngine.playClick();
      this.gameEngine.passTurn('player');
    });
    this.clashMashBtn?.addEventListener('click', () => this.gameEngine.mashBeamClash());

    if (this.dropZone) {
      this.dropZone.addEventListener('dragover', e => {
        e.preventDefault();
        this.dropZone.classList.add('drag-over');
      });
      this.dropZone.addEventListener('dragleave', () => this.dropZone.classList.remove('drag-over'));
      this.dropZone.addEventListener('drop', e => {
        e.preventDefault();
        this.dropZone.classList.remove('drag-over');
        if (this.draggedCardIndex !== null) {
          this.gameEngine.playCard('player', this.draggedCardIndex);
          this.draggedCardIndex = null;
        }
      });
    }

    document.getElementById('buy-pack-btn')?.addEventListener('click', () => {
      const cards = packOpener.openPack();
      if (cards) { this.renderPackReveal(cards); this.updateCurrencies(); this.renderDeckBuilder(); }
    });

    const sendChatMsg = () => {
      if (this.chatInput?.value.trim()) {
        chatManager.addMessage(authDatabase.getCurrentUser().username, this.chatInput.value.trim());
        this.chatInput.value = '';
        this.renderChat();
      }
    };
    document.getElementById('send-chat-btn')?.addEventListener('click', sendChatMsg);
    this.chatInput?.addEventListener('keydown', e => { if (e.key === 'Enter') sendChatMsg(); });

    document.getElementById('close-ko-btn')?.addEventListener('click', () => {
      this.koModal?.classList.remove('active');
      this.switchTab('lobby');
    });

    this.renderDeckBuilder();
    this.renderDojos();
    this.renderChat();
  }

  /* ── User Session ───────────────────────────────────────────────────── */
  updateUserSessionUI() {
    const user = authDatabase.getCurrentUser();
    deckBuilder.zeni = user.zeni;
    deckBuilder.dust = user.dust;
    this.updateCurrencies();
    if (this.authBtn) {
      this.authBtn.textContent = user.isGuest ? '🔑 Entrar' : `👤 ${user.username}`;
    }
  }

  updateCurrencies() {
    if (this.zeniDisplay) this.zeniDisplay.textContent = deckBuilder.zeni;
    if (this.dustDisplay) this.dustDisplay.textContent = deckBuilder.dust;
  }

  /* ── i18n Translations ──────────────────────────────────────────────── */
  applyTranslations() {
    if (this.langSwitchBtn) this.langSwitchBtn.textContent = i18n.lang === 'pt' ? '🇧🇷 PT-BR' : '🇺🇸 EN';

    const $ = id => document.getElementById(id);
    const t = key => i18n.t(key);

    $('landing-title') && ($('landing-title').textContent = t('landingHeroTitle'));
    $('landing-subtitle') && ($('landing-subtitle').textContent = t('landingHeroSubtitle'));
    $('landing-guest-btn') && ($('landing-guest-btn').textContent = t('btnPlayGuest'));
    $('landing-auth-btn') && ($('landing-auth-btn').textContent = t('btnAuthModal'));
    $('landing-enter-arena-btn') && ($('landing-enter-arena-btn').textContent = t('btnEnterArena'));
    $('feat1-title') && ($('feat1-title').textContent = t('feature1Title'));
    $('feat1-desc') && ($('feat1-desc').textContent = t('feature1Desc'));
    $('feat2-title') && ($('feat2-title').textContent = t('feature2Title'));
    $('feat2-desc') && ($('feat2-desc').textContent = t('feature2Desc'));
    $('feat3-title') && ($('feat3-title').textContent = t('feature3Title'));
    $('feat3-desc') && ($('feat3-desc').textContent = t('feature3Desc'));

    $('select-leader-title') && ($('select-leader-title').textContent = t('selectLeaderTitle'));
    $('select-leader-sub') && ($('select-leader-sub').textContent = t('selectLeaderSub'));

    if (this.passTurnBtn) this.passTurnBtn.textContent = t('passTurnBtn');

    this.renderArena(this.gameEngine);
  }

  /* ── Leader Selection Roster ────────────────────────────────────────── */
  renderLeaderSelectionRoster() {
    const picks = document.querySelectorAll('.leader-pick');
    picks.forEach(card => {
      const leaderId = card.dataset.leader;
      const leader = LEADERS[leaderId];
      if (!leader) return;

      const avatar = card.querySelector('.lp-avatar');
      if (avatar) avatar.innerHTML = assetLoader.renderLeaderPortraitHTML(leader);

      const unlocked = characterUnlocks.isUnlocked(leaderId);
      card.classList.toggle('locked', !unlocked);
      let lockBadge = card.querySelector('.lock-badge');
      if (!unlocked && !lockBadge) {
        lockBadge = document.createElement('div');
        lockBadge.className = 'lock-badge';
        lockBadge.style.cssText = 'font-size:0.6rem; color:#ef4444; font-weight:900; margin-top:4px;';
        lockBadge.textContent = `🔒 ${leader.unlockCost} Zeni`;
        card.appendChild(lockBadge);
      } else if (unlocked && lockBadge) {
        lockBadge.remove();
      }

      card.onclick = () => {
        soundEngine.playClick();
        if (!characterUnlocks.isUnlocked(leaderId)) {
          if (confirm(`Unlock ${leader.name} for ${leader.unlockCost} Zeni?`)) {
            characterUnlocks.unlockCharacter(leaderId, leader.unlockCost, deckBuilder.zeni, cost => {
              deckBuilder.zeni -= cost;
              authDatabase.updateProfileStats({ zeni: deckBuilder.zeni });
              this.updateCurrencies();
              this.renderLeaderSelectionRoster();
    this.initDevPanel();
            });
          }
          return;
        }
        picks.forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        this.selectedLeader = leaderId;
        deckBuilder.activeDeck = getStarterDeckForLeader(leaderId);
        this.renderDeckBuilder();
      };
    });
  }

  /* ── Arena Renderer & Active Played Card Display ────────────────────── */
  renderArena(engine) {
    const p = engine.player;
    const opp = engine.opponent;

    // Phase Banner
    if (this.turnPhaseBar) {
      this.turnPhaseBar.className = 'phase-banner';
      if (engine.state === 'ATTACK_PENDING') {
        const defending = engine.pendingAttack?.attackerKey === 'opponent';
        const hasDef = engine.hasDefensiveResponse('player');
        this.turnPhaseBar.classList.add('phase-reaction');
        if (this.turnPhaseIcon) this.turnPhaseIcon.textContent = '⚠️';
        if (this.turnPhaseText) {
          this.turnPhaseText.textContent = defending
            ? (hasDef ? i18n.t('reactionBannerDefending') : i18n.t('reactionBannerNoDef'))
            : i18n.t('reactionBannerInFlight');
        }
      } else if (engine.initiative === 'player') {
        this.turnPhaseBar.classList.add('phase-player');
        if (this.turnPhaseIcon) this.turnPhaseIcon.textContent = '⚔️';
        if (this.turnPhaseText) this.turnPhaseText.textContent = i18n.t('yourTurnBanner');
      } else {
        this.turnPhaseBar.classList.add('phase-opponent');
        if (this.turnPhaseIcon) this.turnPhaseIcon.textContent = '🛡️';
        if (this.turnPhaseText) this.turnPhaseText.textContent = i18n.t('opponentTurnBanner');
      }
    }

    // Player HUD
    this.renderFighterHUD('p1', p);
    // Opponent HUD
    this.renderFighterHUD('p2', opp);

    // Action buttons
    const canAct = engine.state === 'FREE_ACTION' && engine.initiative === 'player';
    if (this.chargeKiBtn) {
      this.chargeKiBtn.disabled = !canAct;
      this.chargeKiBtn.classList.toggle('overcharge', p.ki >= 10);
      this.chargeKiBtn.innerHTML = p.ki >= 10 ? i18n.t('overchargeKiBtn') : i18n.t('chargeKiBtn');
    }
    if (this.passTurnBtn) {
      this.passTurnBtn.disabled = !canAct;
      this.passTurnBtn.textContent = i18n.t('passTurnBtn');
    }

    // Central Drop Zone — Render Active Played Cards!
    if (this.dropZone) {
      if (engine.pendingAttack) {
        const attackerName = engine.pendingAttack.attackerKey === 'player' ? p.name : opp.name;
        const attackCard = engine.pendingAttack.card;

        this.dropZone.innerHTML = `
          <div class="drop-zone-cards">
            <div class="played-card-slot">
              <span class="played-card-label">⚔️ ${attackerName.toUpperCase()} EM ATAQUE</span>
              <div class="card type-${attackCard.type}${attackCard.rarity === 'super-rare' ? ' super-rare' : ''}">
                ${assetLoader.renderCardArtHTML(attackCard)}
                <div class="card-header"><div class="card-ki-cost">${attackCard.cost}</div></div>
                <div class="card-type-tag tag-${attackCard.type}">${attackCard.type.toUpperCase()}</div>
                ${attackCard.power > 0 ? `<div class="card-power-badge">${attackCard.power} ATK</div>` : ''}
              </div>
            </div>
          </div>
        `;
      } else {
        this.dropZone.innerHTML = `<div class="dz-label" id="drop-zone-label">${i18n.t('dropZoneText')}</div>`;
      }
    }

    // Reaction banner
    if (engine.state === 'ATTACK_PENDING') {
      this.reactionBanner?.classList.add('active');
    } else {
      this.reactionBanner?.classList.remove('active');
    }

    // Beam Clash
    if (engine.state === 'BEAM_CLASH' && engine.beamClash.active) {
      this.beamClashOverlay?.classList.add('active');
      if (this.beamClashFill) this.beamClashFill.style.width = `${engine.beamClash.playerClicks}%`;
    } else {
      this.beamClashOverlay?.classList.remove('active');
    }

        // Beam Clash Button & Overlay
    const mashBtn = document.getElementById('clash-mash-btn');
    if (mashBtn) {
      mashBtn.style.display = engine.state === 'BEAM_CLASH' ? 'inline-block' : 'none';
    }

    // Hand
    this.renderPlayerHand(p.hand, p.ki, engine.state, engine.initiative, engine.pendingAttack, p.isOpenGuard);

    // Logs
    this.renderLogs(engine.battleLogs);

    // Game Over
    if (engine.state === 'GAME_OVER') {
      this.koModal?.classList.add('active');
      if (this.koText) {
        if (engine.winner === 'player') {
          soundEngine.playAwaken();
          this.koText.textContent = i18n.t('victoryTitle');
        } else {
          this.koText.textContent = i18n.t('defeatTitle');
        }
      }
    }
  }

  renderFighterHUD(prefix, fighter) {
    const portrait = document.getElementById(`${prefix}-portrait`);
    const name = document.getElementById(`${prefix}-name`);
    const hpFill = document.getElementById(`${prefix}-hp-fill`);
    const hpText = document.getElementById(`${prefix}-hp-text`);
    const shields = document.getElementById(`${prefix}-shields`);
    const kiSlots = document.getElementById(`${prefix}-ki-slots`);
    const kiText = document.getElementById(`${prefix}-ki-text`);
    const leaderBox = document.getElementById(`${prefix}-leader-box`);

    if (name) name.innerHTML = `${fighter.isAwakened ? fighter.leader.awakenedName : fighter.leader.name} <span class="awaken-badge">AWAKENED</span>`;

    if (hpFill) {
      const pct = Math.max(0, (fighter.hp / fighter.maxHp) * 100);
      hpFill.style.width = `${pct}%`;
      hpFill.className = 'hp-bar-fill';
      if (pct <= 25) hpFill.classList.add('hp-low');
      else if (pct <= 50) hpFill.classList.add('hp-mid');
    }
    if (hpText) hpText.textContent = `${fighter.hp}/${fighter.maxHp} HP`;

    if (portrait) {
      portrait.innerHTML = assetLoader.renderLeaderPortraitHTML(fighter.leader);
      portrait.classList.toggle('awakened', fighter.isAwakened);
    }

    this.renderShields(shields, fighter.shields);
    this.renderKiGauge(kiSlots, kiText, fighter.ki);
    if (leaderBox) leaderBox.classList.toggle('open-guard', fighter.isOpenGuard);
  }

  renderShields(container, count) {
    if (!container) return;
    container.innerHTML = '';
    for (let i = 0; i < 8; i++) {
      const pip = document.createElement('div');
      pip.className = `shield-pip${i >= count ? ' broken' : ''}`;
      container.appendChild(pip);
    }
  }

  renderKiGauge(container, textEl, ki) {
    if (container) {
      container.innerHTML = '';
      for (let i = 0; i < 10; i++) {
        const pip = document.createElement('div');
        pip.className = `ki-pip${i < ki ? ' filled' : ''}`;
        container.appendChild(pip);
      }
    }
    if (textEl) textEl.textContent = `${ki}/10 KI`;
  }

  /* ── Player Hand & Touch Gesture Slide Pop-up ──────────────────────── */
  renderPlayerHand(hand, playerKi, gameState, initiative, pendingAttack, isOpenGuard) {
    if (!this.p1HandContainer) return;
    this.p1HandContainer.innerHTML = '';

    hand.forEach((card, index) => {
      const el = document.createElement('div');

      let isPlayable = false;
      let reasonText = '';

      if (playerKi < card.cost) {
        reasonText = i18n.t('reasonNeedKi');
      } else if (card.type === 'evade' && isOpenGuard) {
        reasonText = i18n.t('reasonOpenGuard');
      } else if (gameState === 'FREE_ACTION' && initiative === 'player') {
        if (card.type === 'attack' || card.type === 'tech') isPlayable = true;
        else reasonText = i18n.t('reasonDefenseOnly');
      } else if (gameState === 'ATTACK_PENDING' && pendingAttack) {
        if (pendingAttack.attackerKey === 'opponent') {
          if (['defense', 'evade', 'counter'].includes(card.type) || card.isBeam) isPlayable = true;
          else reasonText = i18n.t('reasonReactionOnly');
        } else {
          reasonText = i18n.t('reasonInFlight');
        }
      } else if (initiative !== 'player') {
        reasonText = i18n.t('reasonOpponentTurn');
      }

      el.className = `card type-${card.type}${card.rarity === 'super-rare' ? ' super-rare' : ''} ${isPlayable ? 'playable' : 'unplayable'}`;

      el.innerHTML = `
        ${assetLoader.renderCardArtHTML(card)}
        <div class="card-header"><div class="card-ki-cost">${card.cost}</div></div>
        <div class="card-type-tag tag-${card.type}">${card.type.toUpperCase()}</div>
        
        ${card.power > 0 ? `<div class="card-power-badge">${card.power} ATK</div>` : ''}
      `;

      el.draggable = isPlayable;
      el.addEventListener('dragstart', () => { this.draggedCardIndex = index; });

      // Touchscreen Mobile Slide Pop-up Gesture
      el.addEventListener('touchstart', () => {
        if (isPlayable) this.draggedCardIndex = index;
        el.classList.add('touch-hover');
      }, { passive: true });

      el.addEventListener('touchmove', (e) => {
        if (e.touches && e.touches[0]) {
          const touch = e.touches[0];
          const targetEl = document.elementFromPoint(touch.clientX, touch.clientY);
          const parentCard = targetEl ? targetEl.closest('.card') : null;
          
          this.p1HandContainer.querySelectorAll('.card').forEach(c => {
            if (c === parentCard) c.classList.add('touch-hover');
            else c.classList.remove('touch-hover');
          });
        }
      }, { passive: true });

      const clearTouchHover = () => {
        this.p1HandContainer.querySelectorAll('.card').forEach(c => c.classList.remove('touch-hover'));
      };
      el.addEventListener('touchend', clearTouchHover);
      el.addEventListener('touchcancel', clearTouchHover);

      el.addEventListener('click', () => {
        if (isPlayable) {
          soundEngine.playClick();
          soundEngine.playCardPlay(); this.gameEngine.playCard('player', index);
        }
      });

      this.p1HandContainer.appendChild(el);
    });
  }

  /* ── Battle Log ─────────────────────────────────────────────────────── */
  renderLogs(logs) {
    if (!this.battleLogContainer) return;
    this.battleLogContainer.innerHTML = '';
    logs.forEach(log => {
      const line = document.createElement('div');
      line.className = `log-line ${log.type || ''}`;
      line.textContent = `[${log.time}] ${log.msg}`;
      this.battleLogContainer.appendChild(line);
    });
  }

  /* ── Deck Builder & Card Inspect Trigger ───────────────────────────── */
    renderDeckBuilder() {
    const container = document.getElementById('deck-builder-container');
    if (container) {
      deckBuilder.render('deck-builder-container');
      return;
    }

    if (this.deckListContainer) {
      this.deckListContainer.innerHTML = '';
      const deck = deckBuilder.getDeckForLeader(this.selectedLeader);
      deck.forEach((cardId, index) => {
        const card = getCardById(cardId);
        if (!card) return;
        const row = document.createElement('div');
        row.className = 'deck-entry';
        row.style.cssText = 'cursor:pointer; display:flex; justify-content:space-between; align-items:center; padding:8px 12px; background:rgba(255,255,255,0.04); border-radius:6px; margin-bottom:6px; border:1px solid rgba(255,255,255,0.1); color:#fff; font-size:0.8rem; font-weight:700;';
        row.innerHTML = `
          <span class="de-title" style="display:flex; align-items:center; gap:6px;">
            <span style="color:var(--ki-yellow);">${card.cost} Ki</span>
            <span>${card.name}</span>
          </span>
          <button class="de-remove" style="background:none; border:none; color:#ef4444; font-weight:900; font-size:0.9rem; cursor:pointer;">✕</button>
        `;
        row.querySelector('.de-title').onclick = () => this.openCardInspectModal(card);
        row.querySelector('.de-remove').onclick = (e) => {
          e.stopPropagation();
          deckBuilder.removeCardFromDeck(index, this.selectedLeader);
          this.renderDeckBuilder();
        };
        this.deckListContainer.appendChild(row);
      });
    }

    if (this.collectionGrid) {
      this.collectionGrid.innerHTML = '';
      CARD_DATABASE.forEach(card => {
        const el = document.createElement('div');
        el.className = `card type-${card.type}${card.rarity === 'super-rare' ? ' super-rare' : ''}`;
        el.style.cursor = 'pointer';
        el.innerHTML = `
          ${assetLoader.renderCardArtHTML(card)}
          <div class="card-header"><div class="card-ki-cost">${card.cost}</div></div>
          <div class="card-type-tag tag-${card.type}">${card.type.toUpperCase()}</div>
          ${card.power > 0 ? `<div class="card-power-badge">${card.power} ATK</div>` : ''}
        `;
        el.onclick = () => {
          deckBuilder.addCardToDeck(card.id, this.selectedLeader);
          this.renderDeckBuilder();
        };
        this.collectionGrid.appendChild(el);
      });
    }
  }

  renderDojos() {
    if (!this.dojoListContainer) return;
    this.dojoListContainer.innerHTML = '';
    const medals = ['🥇', '🥈', '🥉'];
    DOJO_RANKINGS.forEach((dojo, i) => {
      const row = document.createElement('div');
      row.className = 'dojo-row';
      row.innerHTML = `
        <div style="display:flex;align-items:center;gap:10px;">
          <span class="dojo-rank">${medals[i] || `#${i + 1}`}</span>
          <span>${dojo.icon} ${dojo.name} <span style="color:var(--text-dim)">(${dojo.leader})</span></span>
        </div>
        <span class="dojo-power">${dojo.power} PWR</span>
      `;
      this.dojoListContainer.appendChild(row);
    });
  }

  /* ── Chat ────────────────────────────────────────────────────────────── */
  renderChat() {
    if (!this.chatFeed) return;
    this.chatFeed.innerHTML = '';
    chatManager.messages.forEach(msg => {
      const bubble = document.createElement('div');
      bubble.className = 'chat-bubble';
      bubble.innerHTML = `<span class="cb-user">${msg.user}</span><span class="cb-time">${msg.time}</span><br>${msg.text}`;
      this.chatFeed.appendChild(bubble);
    });
    this.chatFeed.scrollTop = this.chatFeed.scrollHeight;
  }

  /* ── Pack Reveal ────────────────────────────────────────────────────── */
  renderPackReveal(cards) {
    if (!this.packRevealContainer) return;
    this.packRevealContainer.innerHTML = '';
    cards.forEach(card => {
      const el = document.createElement('div');
      el.className = `card type-${card.type}${card.rarity === 'super-rare' ? ' super-rare' : ''}`;
      el.style.cursor = 'pointer';
      el.innerHTML = `
        ${assetLoader.renderCardArtHTML(card)}
        <div class="card-header"><div class="card-ki-cost">${card.cost}</div></div>
        <div class="card-type-tag tag-${card.type}">${card.type.toUpperCase()}</div>
        ${card.power > 0 ? `<div class="card-power-badge">${card.power} ATK</div>` : ''}
      `;
      el.onclick = () => this.openCardInspectModal(card);
      this.packRevealContainer.appendChild(el);
    });
  }

  /* ── DEV ADMIN PANEL CONTROLLER ────────────────────────────────────── */
  initDevPanel() {
    const modal = document.getElementById('dev-panel-modal');
    const openBtn = document.getElementById('open-dev-panel-btn');
    const closeBtn = document.getElementById('close-dev-modal-btn');
    const exportBtn = document.getElementById('dev-export-btn');
    const importBtn = document.getElementById('dev-import-btn');
    const resetAllBtn = document.getElementById('dev-reset-all-btn');
    const fileInput = document.getElementById('dev-import-file-input');

    if (openBtn) openBtn.onclick = () => { soundEngine.playClick(); this.openDevPanel(); };
    if (closeBtn) closeBtn.onclick = () => modal?.classList.remove('active');

    window.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        soundEngine.playClick();
        this.openDevPanel();
      }
    });

    if (exportBtn) {
      exportBtn.onclick = () => {
        const exports = {};
        CARD_DATABASE.forEach(c => {
          const custom = localStorage.getItem(`dbtcg_custom_card_${c.id}`);
          if (custom) exports[c.id] = custom;
        });
        const blob = new Blob([JSON.stringify(exports, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'dbtcg_custom_cards_backup.json';
        a.click();
      };
    }

    if (importBtn && fileInput) {
      importBtn.onclick = () => fileInput.click();
      fileInput.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
          try {
            const data = JSON.parse(evt.target.result);
            Object.keys(data).forEach(id => {
              localStorage.setItem(`dbtcg_custom_card_${id}`, data[id]);
            });
            alert('Custom cards backup imported successfully!');
            this.renderDevPanel();
            this.renderDeckBuilder();
          } catch (err) {
            alert('Invalid backup JSON file.');
          }
        };
        reader.readAsText(file);
      };
    }

    if (resetAllBtn) {
      resetAllBtn.onclick = () => {
        if (confirm('Restaurar todas as artes de cartas para o padrão?')) {
          CARD_DATABASE.forEach(c => localStorage.removeItem(`dbtcg_custom_card_${c.id}`));
          this.renderDevPanel();
          this.renderDeckBuilder();
        }
      };
    }
  }

  openDevPanel() {
    const modal = document.getElementById('dev-panel-modal');
    if (!modal) return;
    modal.classList.add('active');
    this.renderDevPanel();
  }

  renderDevPanel() {
    const grid = document.getElementById('dev-card-list-grid');
    if (!grid) return;
    grid.innerHTML = '';

    CARD_DATABASE.forEach(card => {
      const cardBox = document.createElement('div');
      cardBox.style.cssText = 'background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.12); border-radius: 8px; padding: 10px; display: flex; gap: 10px; align-items: center;';

      const imgSrc = assetLoader.getCardImagePath(card.id);
      const isCustom = !!localStorage.getItem(`dbtcg_custom_card_${card.id}`);

      cardBox.innerHTML = `
        <div style="width: 50px; height: 70px; border-radius: 4px; overflow: hidden; background: #000; flex-shrink: 0; position: relative;">
          <img src="${imgSrc}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.style.display='none';">
          ${isCustom ? '<span style="position:absolute; top:2px; right:2px; font-size:0.5rem; background:#10b981; color:#000; padding:1px 3px; font-weight:900; border-radius:2px;">CUSTOM</span>' : ''}
        </div>
        <div style="flex-grow: 1; overflow: hidden;">
          <div style="font-weight: 800; font-size: 0.8rem; color: #ffd700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${card.name}</div>
          <div style="font-size: 0.65rem; color: #9ca3af; margin-bottom: 6px;">ID: ${card.id} | ${card.cost} Ki | ${card.type.toUpperCase()}</div>
          <div style="display: flex; gap: 6px;">
            <label class="btn-ghost" style="font-size: 0.65rem; padding: 3px 8px; cursor: pointer; border-color: #ffd700; color: #ffd700;">
              📁 Upload PNG
              <input type="file" accept="image/*" class="dev-card-file-input" data-card="${card.id}" style="display: none;">
            </label>
            ${isCustom ? `<button class="btn-ghost dev-reset-card-btn" data-card="${card.id}" style="font-size: 0.65rem; padding: 3px 8px; border-color: #ef4444; color: #ef4444;">Restaurar</button>` : ''}
          </div>
        </div>
      `;

      const input = cardBox.querySelector('.dev-card-file-input');
      if (input) {
        input.onchange = (e) => {
          const file = e.target.files[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = (evt) => {
            localStorage.setItem(`dbtcg_custom_card_${card.id}`, evt.target.result);
            soundEngine.playClick();
            this.renderDevPanel();
            this.renderDeckBuilder();
          };
          reader.readAsDataURL(file);
        };
      }

      const resetBtn = cardBox.querySelector('.dev-reset-card-btn');
      if (resetBtn) {
        resetBtn.onclick = () => {
          localStorage.removeItem(`dbtcg_custom_card_${card.id}`);
          soundEngine.playClick();
          this.renderDevPanel();
          this.renderDeckBuilder();
        };
      }

      grid.appendChild(cardBox);
    });
  }
}
>>>>>>> 75cdb2b5faac518831c31cadd3baa480b065f443
