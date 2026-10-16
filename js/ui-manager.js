import { authManager } from './auth-manager.js';
import { leaderboardManager } from './leaderboard-manager.js';
import { raidEngine } from './raid-engine.js';
import { socketManager } from './socket-config.js';
import { Mode2v2Engine } from './mode-2v2.js';
import { ModeRaidEngine } from './mode-raid.js';
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
import { spriteAnimator } from './sprite-animator.js';
import { getCardById, LEADERS, getStarterDeckForLeader, CARD_DATABASE } from './card-database.js';
import { authDatabase } from './auth-database.js';
import { i18n } from './i18n.js';

import { sceneManager, GAME_SCENES } from './scene-manager.js';

export class UIManager {
  renderShop() {
    const zeniEl = document.getElementById('shop-zeni');
    if (zeniEl && typeof deckBuilder !== 'undefined') {
      zeniEl.textContent = deckBuilder.zeni || 0;
    }
  }

  constructor() {
    this.fx = new FXEngine('fx-canvas');
    this.startFighterSpriteLoop();

    this.gameEngine = new GameEngine(
      this.renderArena.bind(this),
      this.handleFXEvent.bind(this)
    );

    const updateTimerBar = (secondsLeft, maxSec = 3.0) => {
      if (this.timerBarFill) {
        const pct = (secondsLeft / maxSec) * 100;
        this.timerBarFill.style.width = `${Math.max(0, pct)}%`;
      }
    };

    this.gameEngine.onTimerTick = updateTimerBar;

    this.multiplayer = new MultiplayerManager(this.gameEngine);
    this.tutorial = new TutorialManager(this);

    this.activeGameMode = '1v1';
    this.mode2v2 = new Mode2v2Engine(
      (state) => this.render2v2Arena(state),
      (log) => this.renderLogs([log])
    );
    this.mode2v2.onTimerTick = updateTimerBar;
    // Conecta FX do 2v2 ao fxEngine e soundEngine (igual ao 1v1)
    this.mode2v2.onFx = (type, data) => {
      this.handleFXEvent(type, data);
    };

    this.modeRaid = new ModeRaidEngine(
      (state) => this.renderRaidArena(state),
      (log) => this.renderLogs([log])
    );
    this.modeRaid.onTimerTick = updateTimerBar;
    // Conecta FX do Raid ao fxEngine e soundEngine (igual ao 1v1)
    this.modeRaid.onFx = (type, data) => {
      this.handleFXEvent(type, data);
    };

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
    this.setupAuthAndLeaderboardHandlers();
    this.initSceneSystem();
  }


  triggerScreenShake() {
    const screen = document.getElementById('scene-arena');
    if (!screen) return;
    screen.classList.remove('shake-screen');
    void screen.offsetWidth;
    screen.classList.add('shake-screen');
    setTimeout(() => screen.classList.remove('shake-screen'), 400);
  }

  triggerFloatingDamage(x, y, text) {
    const container = document.getElementById('scene-arena');
    if (!container) return;
    const el = document.createElement('div');
    el.className = 'floating-damage-popup';
    el.textContent = text;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    container.appendChild(el);
    setTimeout(() => el.remove(), 850);
  }

  triggerImpactEffects(x, y, damage = 40, defenderKey = null, attackType = 'punch') {
    this.triggerScreenShake();
    this.triggerFloatingDamage(x, y - 30, `-${damage}`);
    if (this.fx && typeof this.fx.triggerImpactHit === 'function') {
      this.fx.triggerImpactHit(x, y);
    }
    const hpBarId = defenderKey === 'player' ? 'p1-hp-bar-wrapper' : 'p2-hp-bar-wrapper';
    this.triggerHpBarImpactFlash(hpBarId, damage);

    if (typeof soundEngine.playPunch === 'function') soundEngine.playPunch();
    else if (typeof soundEngine.playBeamBlast === 'function') soundEngine.playBeamBlast();
  }

  triggerHpBarImpactFlash(barWrapperId, damage) {
    const bar = document.getElementById(barWrapperId);
    const container = document.getElementById('scene-arena');
    if (!container) return;
    // Red flash overlay on the whole arena
    const flash = document.createElement('div');
    flash.className = 'impact-flash-overlay';
    container.appendChild(flash);
    setTimeout(() => flash.remove(), 260);
    // Manga IMPACT starburst near the HP bar
    if (bar) {
      const rect = bar.getBoundingClientRect();
      const arenaRect = container.getBoundingClientRect();
      const cx = rect.left - arenaRect.left + rect.width / 2;
      const cy = rect.top - arenaRect.top + rect.height / 2;
      const starburst = document.createElement('div');
      starburst.className = 'manga-impact-starburst';
      starburst.style.left = `${cx}px`;
      starburst.style.top = `${cy}px`;
      starburst.innerHTML = `<span class="impact-damage-num">-${damage}</span>`;
      container.appendChild(starburst);
      setTimeout(() => starburst.remove(), 700);
    }
  }

  /* ── Anime Action Splash Banner (DBZ Fighting Game Style) ────────────── */
  triggerActionBanner(text, actClass = 'act-attack', subtext = '') {
    let banner = document.getElementById('anime-action-banner');
    const container = document.getElementById('scene-arena');
    if (!banner && container) {
      banner = document.createElement('div');
      banner.id = 'anime-action-banner';
      banner.className = 'dbz-action-banner-container';
      container.appendChild(banner);
    }
    if (banner) {
      const badge = this._getBannerCategoryLabel(actClass);
      banner.innerHTML = `
        <div class="dbz-banner-slash-bg ${actClass}"></div>
        <div class="dbz-banner-content">
          <div class="dbz-banner-badge">[ ${badge} ]</div>
          <div class="dbz-banner-title">${text}</div>
          ${subtext ? `<div class="dbz-banner-sub">${subtext}</div>` : ''}
        </div>
      `;
      banner.className = `dbz-action-banner-container ${actClass} active`;
      if (this.actionBannerTimer) clearTimeout(this.actionBannerTimer);
      this.actionBannerTimer = setTimeout(() => {
        banner.classList.remove('active');
      }, 1200);
    }
  }

  showGameResult(isPlayerWinner) {
    const existing = document.getElementById('game-result-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'game-result-overlay';
    overlay.className = 'game-result-overlay';

    const rpText = isPlayerWinner ? '+25 RP' : '-10 RP';
    const rpClass = isPlayerWinner ? 'rp-gain' : 'rp-loss';

    overlay.innerHTML = `
      <div class="game-result-bg"></div>
      <div class="game-result-content">
        <div class="result-ko ${isPlayerWinner ? 'ko-win' : 'ko-lose'}">K.O.</div>
        <div class="result-title ${isPlayerWinner ? 'title-win' : 'title-lose'}">${isPlayerWinner ? 'VITÓRIA' : 'DERROTA'}</div>
        <div class="result-divider"></div>
        <div class="result-rp ${rpClass}">${rpText}</div>
        <button class="result-btn" id="result-btn-menu">VOLTAR AO MENU</button>
      </div>
    `;

    document.body.appendChild(overlay);

    setTimeout(() => overlay.classList.add('active'), 50);

    document.getElementById('result-btn-menu').addEventListener('click', () => {
      overlay.remove();
      sceneManager.switchScene(GAME_SCENES.MAIN_MENU);
    });
  }

  _getBannerCategoryLabel(actClass) {
    switch (actClass) {
      case 'act-soco': return '🥊 SOCO (COMBO FÍSICO)';
      case 'act-ki_blast': return '💥 KI BLAST (FEIXE DE KI)';
      case 'act-defesa': return '🛡️ DEFESA (GUARDA / BLOQUEIO)';
      case 'act-efeito': return '⚡ EFEITO SIMPLES (TÁTICO)';
      case 'act-charge': return '⚡ CARGA DE KI';
      case 'act-ultimate': return '🔥 GOLPE FINAL SUPREMO';
      case 'act-special': return '💥 DISPUTA DE BEAM';
      case 'act-physical': return '🥊 SOCO FÍSICO';
      case 'act-evade': return '💨 Z-VANISH / ESQUIVA';
      case 'act-awaken': return '🔥 LIMIT BREAK DESPERTO';
      default: return '⚔️ AÇÃO DE BATALHA';
    }
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

    if (type === 'beamClash') {
      if (this.beamClashFill) this.beamClashFill.style.width = `${data.p1Progress}%`;
      if (this.fx && this.fx.triggerBeamClash) {
        this.fx.triggerBeamClash(data.p1Progress, data.p1Color || '#00f2fe', data.p2Color || '#ffd700');
      }
      return;
    }

    const now = Date.now();
    if (this.lastFxType === type && this.lastFxTime && (now - this.lastFxTime < 600)) {
      return; // Debounce duplicate cutscene/banner FX
    }
    this.lastFxType = type;
    this.lastFxTime = now;

    const attackerKey = data.attackerKey || (this.gameEngine ? this.gameEngine.initiative : 'player');
    const defenderKey = attackerKey === 'player' ? 'opponent' : 'player';
    const leader = (attackerKey === 'opponent' ? this.gameEngine?.opponent?.leader : this.gameEngine?.player?.leader) || {};
    const targetBox = document.getElementById(attackerKey === 'opponent' ? 'p1-leader-box' : 'p2-leader-box');
    const vec = this.getBeamVector(attackerKey);

    if (type === 'kiAura') {
      soundEngine.playKiCharge();
      this.triggerActionBanner('CARREGAR KI (+2 KI)', 'act-charge', '気力充填');
      this.fx.spawnKiAura(vec.fromX, vec.fromY, data.color);
    } else if (type === 'attackCharging') {
      const cardTitle = data.card ? data.card.name.toUpperCase() : 'ATAQUE DE KI';
      this.triggerActionBanner(`CARREGANDO ${cardTitle}`, 'act-ultimate', '気力集中・構え');
      soundEngine.playKamehamehaCharge();
      this.fx.spawnKiAura(vec.fromX, vec.fromY, '#ffd700');
    } else if (type === 'beamClashStart') {
      soundEngine.playBeamBlast();
      this.triggerScreenShake();
      this.triggerActionBanner('BEAM CLASH - CHOQUE DE PODER', 'act-ultimate', 'エネルギー衝突');
    } else if (type === 'kamehameha') {
      const cardTitle = data.card ? data.card.name.toUpperCase() : 'SUPER KAMEHAMEHA!';
      this.triggerActionBanner(`${cardTitle}`, 'act-ultimate', 'カメハメ波');
      soundEngine.playKamehamehaCharge();
      cutsceneEngine.playAttackSequence({
        type: ANIMATION_TYPES.SUPER_KAMEHAMEHA,
        leaderIcon: leader.icon || '🔥',
        leaderName: leader.name || 'Goku',
        attackName: cardTitle,
        targetEl: targetBox,
        damage: data.damage || 40,
        customQuote: leader.quote || 'KA... ME... HA... ME... HAAA!',
        onImpact: () => {
          soundEngine.playKamehamehaImpact();
          this.triggerImpactEffects(vec.toX, vec.toY, data.damage || 40, defenderKey, "kamehameha");
          this.fx.fireKamehameha(vec.fromX, vec.fromY, vec.toX, vec.toY, data.isGolden);
        }
      });
    } else if (type === 'genkidama') {
      const cardTitle = data.card ? data.card.name.toUpperCase() : 'GENKI DAMA!';
      this.triggerActionBanner(`${cardTitle}`, 'act-attack');
      cutsceneEngine.playAttackSequence({
        type: ANIMATION_TYPES.GENKI_DAMA,
        leaderIcon: leader.icon || '🌐',
        leaderName: leader.name || 'Goku',
        attackName: cardTitle,
        targetEl: targetBox,
        damage: data.damage || 60,
        customQuote: 'TODOS DA TERRA, ME DÊEM SUA ENERGIA!',
        onImpact: () => {
          this.triggerImpactEffects(vec.toX, vec.toY, data.damage || 40, defenderKey, "genkidama");
          this.fx.fireGenkiDama(vec.fromX, vec.fromY, vec.toX, vec.toY);
        }
      });
    } else if (type === 'finalFlash') {
      const cardTitle = data.card ? data.card.name.toUpperCase() : 'FINAL FLASH!';
      this.triggerActionBanner(`${cardTitle}`, 'act-attack');
      cutsceneEngine.playAttackSequence({
        type: ANIMATION_TYPES.FINAL_FLASH,
        leaderIcon: leader.icon || '⚡',
        leaderName: leader.name || 'Vegeta',
        attackName: cardTitle,
        targetEl: targetBox,
        damage: data.damage || 50,
        customQuote: 'FINAL... FLAAAASH!',
        onImpact: () => {
          this.triggerImpactEffects(vec.toX, vec.toY, data.damage || 40, defenderKey, "finalFlash");
          this.fx.fireFinalFlash(vec.fromX, vec.fromY, vec.toX, vec.toY);
        }
      });
    } else if (type === 'deathBeam') {
      const cardTitle = data.card ? data.card.name.toUpperCase() : 'DEATH BEAM!';
      this.triggerActionBanner(`${cardTitle}`, 'act-attack');
      cutsceneEngine.playAttackSequence({
        type: ANIMATION_TYPES.DEATH_BEAM,
        leaderIcon: leader.icon || '👿',
        leaderName: leader.name || 'Frieza',
        attackName: cardTitle,
        targetEl: targetBox,
        damage: data.damage || 35,
        customQuote: 'DANCE PARA MIM, MACACO!',
        onImpact: () => {
          this.triggerImpactEffects(vec.toX, vec.toY, data.damage || 40, defenderKey, "deathBeam");
          this.fx.fireDeathBeam(vec.fromX, vec.fromY, vec.toX, vec.toY);
        }
      });
    } else if (type === 'specialBeam') {
      const cardTitle = data.card ? data.card.name.toUpperCase() : 'SPECIAL BEAM CANNON!';
      this.triggerActionBanner(`${cardTitle}`, 'act-attack');
      cutsceneEngine.playAttackSequence({
        type: ANIMATION_TYPES.DEATH_BEAM,
        leaderIcon: leader.icon || '🌀',
        leaderName: leader.name || 'Piccolo',
        attackName: cardTitle,
        targetEl: targetBox,
        damage: data.damage || 45,
        customQuote: 'MAKANKOSAPPO!',
        onImpact: () => {
          this.triggerImpactEffects(vec.toX, vec.toY, data.damage || 40, defenderKey, "specialBeam");
          this.fx.fireSpecialBeam(vec.fromX, vec.fromY, vec.toX, vec.toY);
        }
      });
    } else if (type === 'masenko') {
      const cardTitle = data.card ? data.card.name.toUpperCase() : 'MASENKO!';
      this.triggerActionBanner(`${cardTitle}`, 'act-attack');
      cutsceneEngine.playAttackSequence({
        type: ANIMATION_TYPES.SUPER_KAMEHAMEHA,
        leaderIcon: leader.icon || '💥',
        leaderName: leader.name || 'Gohan',
        attackName: cardTitle,
        targetEl: targetBox,
        damage: data.damage || 40,
        customQuote: 'MASENKO... HA!',
        onImpact: () => {
          this.triggerImpactEffects(vec.toX, vec.toY, data.damage || 40, defenderKey, "masenko");
          this.fx.fireMasenko(vec.fromX, vec.fromY, vec.toX, vec.toY);
        }
      });
    } else if (type === 'bigBang') {
      const cardTitle = data.card ? data.card.name.toUpperCase() : 'BIG BANG ATTACK!';
      this.triggerActionBanner(`${cardTitle}`, 'act-attack');
      cutsceneEngine.playAttackSequence({
        type: ANIMATION_TYPES.SUPER_KAMEHAMEHA,
        leaderIcon: leader.icon || '🔵',
        leaderName: leader.name || 'Vegeta',
        attackName: cardTitle,
        targetEl: targetBox,
        damage: data.damage || 55,
        customQuote: 'BIG BANG ATTACK!',
        onImpact: () => {
          this.triggerImpactEffects(vec.toX, vec.toY, data.damage || 40, defenderKey, "bigBang");
          this.fx.fireBigBang(vec.fromX, vec.fromY, vec.toX, vec.toY);
        }
      });
    } else if (type === 'burningAttack') {
      const cardTitle = data.card ? data.card.name.toUpperCase() : 'BURNING ATTACK!';
      this.triggerActionBanner(`${cardTitle}`, 'act-attack');
      cutsceneEngine.playAttackSequence({
        type: ANIMATION_TYPES.SUPER_KAMEHAMEHA,
        leaderIcon: leader.icon || '🔥',
        leaderName: leader.name || 'Trunks',
        attackName: cardTitle,
        targetEl: targetBox,
        damage: data.damage || 45,
        customQuote: 'BURNING ATTACK!',
        onImpact: () => {
          this.triggerImpactEffects(vec.toX, vec.toY, data.damage || 40, defenderKey, "burningAttack");
          this.fx.fireBurningAttack(vec.fromX, vec.fromY, vec.toX, vec.toY);
        }
      });
    } else if (type === 'punch') {
      const cardTitle = data.card ? data.card.name.toUpperCase() : 'IMPACTO DIRETO!';
      this.triggerActionBanner(`${cardTitle}`, 'act-physical', '打撃連撃');
      soundEngine.playClashPunches(750);
      cutsceneEngine.playAttackSequence({
        type: ANIMATION_TYPES.PHYSICAL_ATTACK,
        leaderIcon: leader.icon || '💥',
        leaderName: leader.name || 'Fighter',
        attackName: cardTitle,
        targetEl: targetBox,
        damage: data.damage || 25,
        onImpact: () => {
          this.triggerImpactEffects(vec.toX, vec.toY, data.damage || 40, defenderKey, "punch");
          this.fx.triggerImpactHit(vec.toX, vec.toY);
        }
      });
    } else if (type === 'supernova') {
      const cardTitle = data.card ? data.card.name.toUpperCase() : 'SUPERNOVA!';
      this.triggerActionBanner(`${cardTitle}`, 'act-attack');
      cutsceneEngine.playAttackSequence({
        type: ANIMATION_TYPES.GENKI_DAMA,
        leaderIcon: leader.icon || '☀️',
        leaderName: leader.name || 'Frieza',
        attackName: cardTitle,
        targetEl: targetBox,
        damage: data.damage || 75,
        customQuote: 'ESTE PLANETA VAI CASSAR EM POEIRA!',
        onImpact: () => {
          this.triggerImpactEffects(vec.toX, vec.toY, data.damage || 40, defenderKey, "supernova");
          this.fx.fireSupernova(vec.fromX, vec.fromY, vec.toX, vec.toY);
        }
      });
    } else if (type === 'kienzan') {
      const cardTitle = data.card ? data.card.name.toUpperCase() : 'KIENZAN!';
      this.triggerActionBanner(`${cardTitle}`, 'act-attack');
      cutsceneEngine.playAttackSequence({
        type: ANIMATION_TYPES.KI_BLAST,
        leaderIcon: leader.icon || '✨',
        leaderName: leader.name || 'Fighter',
        attackName: cardTitle,
        targetEl: targetBox,
        damage: data.damage || 45,
        onImpact: () => {
          this.triggerImpactEffects(vec.toX, vec.toY, data.damage || 40, defenderKey, "kienzan");
          this.fx.fireKienzan(vec.fromX, vec.fromY, vec.toX, vec.toY);
        }
      });
    } else if (type === 'kikoho') {
      const cardTitle = data.card ? data.card.name.toUpperCase() : 'KIKOHO TRI-BEAM!';
      this.triggerActionBanner(`${cardTitle}`, 'act-attack');
      cutsceneEngine.playAttackSequence({
        type: ANIMATION_TYPES.SUPER_KAMEHAMEHA,
        leaderIcon: leader.icon || '🟨',
        leaderName: leader.name || 'Tien',
        attackName: cardTitle,
        targetEl: targetBox,
        damage: data.damage || 50,
        customQuote: 'KIKOHOOOO!',
        onImpact: () => {
          this.triggerImpactEffects(vec.toX, vec.toY, data.damage || 40, defenderKey, "kikoho");
          this.fx.triggerImpactHit(vec.toX, vec.toY);
        }
      });
    } else if (type === 'dragonFist') {
      const cardTitle = data.card ? data.card.name.toUpperCase() : 'DRAGON FIST RUSH!';
      this.triggerActionBanner(`${cardTitle}`, 'act-attack');
      cutsceneEngine.playAttackSequence({
        type: ANIMATION_TYPES.PHYSICAL_ATTACK,
        leaderIcon: leader.icon || '🐉',
        leaderName: leader.name || 'Goku',
        attackName: cardTitle,
        targetEl: targetBox,
        damage: data.damage || 35,
        customQuote: 'SE SEU PODER NÃO É SUFICIENTE, EU TE ATRAVESSAREI!',
        onImpact: () => {
          this.triggerImpactEffects(vec.toX, vec.toY, data.damage || 40, defenderKey, "dragonFist");
          this.fx.triggerImpactHit(vec.toX, vec.toY);
        }
      });
    } else if (type === 'meteorCombination') {
      const cardTitle = data.card ? data.card.name.toUpperCase() : 'METEOR COMBINATION!';
      this.triggerActionBanner(`${cardTitle}`, 'act-attack');
      cutsceneEngine.playAttackSequence({
        type: ANIMATION_TYPES.PHYSICAL_ATTACK,
        leaderIcon: leader.icon || '🥊',
        leaderName: leader.name || 'Fighter',
        attackName: cardTitle,
        targetEl: targetBox,
        damage: data.damage || 25,
        onImpact: () => {
          this.triggerImpactEffects(vec.toX, vec.toY, data.damage || 40, defenderKey, "meteorCombination");
          this.fx.fireMeteorCombination(vec.fromX, vec.fromY, vec.toX, vec.toY);
        }
      });
    } else if (type === 'spiritSword') {
      const cardTitle = data.card ? data.card.name.toUpperCase() : 'SPIRIT SWORD SLASH!';
      this.triggerActionBanner(`${cardTitle}`, 'act-attack');
      cutsceneEngine.playAttackSequence({
        type: ANIMATION_TYPES.SUPER_KAMEHAMEHA,
        leaderIcon: leader.icon || '🗡️',
        leaderName: leader.name || 'Trunks',
        attackName: cardTitle,
        targetEl: targetBox,
        damage: data.damage || 45,
        customQuote: 'ESTE É O PODER DA ESPADA DA ESPERANÇA!',
        onImpact: () => {
          this.triggerImpactEffects(vec.toX, vec.toY, data.damage || 40, defenderKey, "spiritSword");
          this.fx.fireSpiritSword(vec.fromX, vec.fromY, vec.toX, vec.toY);
        }
      });
    } else if (type === 'kiBlast') {
      const cardTitle = data.card ? data.card.name.toUpperCase() : 'DISPARO DE KI!';
      this.triggerActionBanner(`${cardTitle}`, 'act-attack');
      cutsceneEngine.playAttackSequence({
        type: ANIMATION_TYPES.KI_BLAST,
        leaderIcon: leader.icon || '⚡',
        leaderName: leader.name || 'Fighter',
        attackName: cardTitle,
        targetEl: targetBox,
        damage: data.damage || 20,
        onImpact: () => {
          this.triggerImpactEffects(vec.toX, vec.toY, data.damage || 20, defenderKey, "kiBlast");
          this.fx.triggerImpactHit(vec.toX, vec.toY);
        }
      });
    } else if (type === 'solarFlare') {
      const cardTitle = data.card ? data.card.name.toUpperCase() : 'SOLAR FLARE!';
      this.triggerActionBanner(`${cardTitle}`, 'act-attack');
      cutsceneEngine.playAttackSequence({
        type: ANIMATION_TYPES.KI_BLAST,
        leaderIcon: leader.icon || '☀️',
        leaderName: leader.name || 'Fighter',
        attackName: cardTitle,
        targetEl: targetBox,
        onImpact: () => {
          soundEngine.playBeamBlast();
        }
      });
    } else if (type === 'timeSkip') {
      const cardTitle = data.card ? data.card.name.toUpperCase() : 'TIME SKIP!';
      this.triggerActionBanner(`${cardTitle}`, 'act-attack');
      cutsceneEngine.playAttackSequence({
        type: ANIMATION_TYPES.PHYSICAL_ATTACK,
        leaderIcon: leader.icon || '⏳',
        leaderName: leader.name || 'Hit',
        attackName: cardTitle,
        targetEl: targetBox,
        onImpact: () => {
          soundEngine.playZVanish();
        }
      });
    } else if (type === 'counter') {
      this.triggerActionBanner('Z-COUNTER! CONTRA-ATAQUE', 'act-evade', 'カウンター');
      soundEngine.playPunch();
    } else if (type === 'zvanish') {
      soundEngine.playZVanish();
      this.triggerActionBanner('Z-VANISH TELEPORT', 'act-evade', '瞬身');
      this.fx.triggerZVanish(data.x || 500, data.y || 250, data.color);
    } else if (type === 'cardClash') {
      this.triggerCardClashAnimation(data.atkCard, data.defCard, data.mode, defenderKey);
    } else if (type === 'awaken') {
      soundEngine.playAwaken();
      this.triggerActionBanner('AWAKEN! PODER TOTAL', 'act-awaken', '限界突破');
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

  triggerPlayedCardFX(card, attackerName = '', defenderName = '', damage = 35) {
    if (!card) return;

    if (soundEngine) {
      soundEngine.playCardPlay();
      if (card.isBeam) setTimeout(() => soundEngine.playBeamDamage(), 300);
      else setTimeout(() => soundEngine.playPunch(), 300);
    }

    this.triggerActionBanner(`${card.name.toUpperCase()}!`, 'act-attack', attackerName || 'GUERREIRO Z');
    this.triggerScreenShake();

    const cardNameLower = (card.name || '').toLowerCase();
    let fxType = 'kiBlast';
    if (cardNameLower.includes('kamehameha')) fxType = 'kamehameha';
    else if (cardNameLower.includes('flash')) fxType = 'finalFlash';
    else if (cardNameLower.includes('dragon')) fxType = 'dragonFist';
    else if (cardNameLower.includes('spirit') || cardNameLower.includes('genki')) fxType = 'spiritSword';
    else if (cardNameLower.includes('meteor')) fxType = 'meteorCombination';

    try {
      this.handleFXEvent(fxType, {
        card,
        damage,
        attackerKey: 'player',
        defenderKey: 'opponent'
      });
    } catch(e) {
      console.warn('FX playback note:', e);
    }
  }

  
  /* ── Defense & Counter Reaction Card Clash Animation ────────────────── */
  triggerCardClashAnimation(atkCard, defCard, mode = 'counter', defenderKey = 'opponent') {
    const container = document.getElementById('scene-arena');
    if (!container) return;

    // Resolve real card PNG images from assets/cards/
    const atkCardObj = typeof atkCard === 'string' ? getCardById(atkCard) : atkCard;
    const defCardObj = typeof defCard === 'string' ? getCardById(defCard) : defCard;

    const atkImg = atkCardObj?.image || (atkCardObj?.id ? `assets/cards/${atkCardObj.id}.png` : 'assets/cards/atk_02.png');
    const defImg = defCardObj?.image || (defCardObj?.id ? `assets/cards/${defCardObj.id}.png` : (mode === 'defense' ? 'assets/cards/def_01.png' : 'assets/cards/def_02.png'));

    const atkTitle = (atkCardObj?.name || 'ATAQUE').toUpperCase();
    const defTitle = (defCardObj?.name || (mode === 'evade' ? 'Z-VANISH' : (mode === 'defense' ? 'DEFESA' : 'Z-COUNTER'))).toUpperCase();

    // Audio SFX per mode
    if (mode === 'evade') {
      soundEngine.playZVanish();
    } else if (mode === 'defense') {
      soundEngine.playCardClash();
      soundEngine.playBeamDamage();
    } else {
      soundEngine.playCardClash();
      soundEngine.playClashPunches(700);
    }
    this.triggerScreenShake();

    const overlay = document.createElement('div');
    overlay.className = `card-clash-overlay mode-${mode}`;

    overlay.innerHTML = `
      <div class="clash-card-wrapper left">
        <img src="${atkImg}" class="clash-card-img" alt="${atkTitle}" onerror="this.onerror=null; this.src='assets/cards/atk_02.png';">
        <div class="clash-card-title">${atkTitle}</div>
      </div>
      <div class="clash-impact-star mode-${mode}"></div>
      <div class="clash-card-wrapper right">
        <img src="${defImg}" class="clash-card-img" alt="${defTitle}" onerror="this.onerror=null; this.src='assets/cards/def_01.png';">
        <div class="clash-card-title">${defTitle}</div>
      </div>
    `;

    container.appendChild(overlay);

    // Action Banner per mode
    let bannerText = 'Z-COUNTER! CONTRA-ATAQUE';
    let bannerClass = 'act-attack';
    let bannerSub = '反撃・ガード崩し';

    if (mode === 'evade') {
      bannerText = 'Z-VANISH! ESQUIVA PERFEITA';
      bannerClass = 'act-evade';
      bannerSub = '回避・瞬間移動';
    } else if (mode === 'defense') {
      bannerText = 'BARREIRA DE DEFESA! DANO BLOQUEADO';
      bannerClass = 'act-charge';
      bannerSub = '防御障壁・ガード';
    }

    this.triggerActionBanner(bannerText, bannerClass, bannerSub);

    // Trigger Pixel Art Sprite Sheet Animation at Collision Center
    setTimeout(() => {
      const cx = window.innerWidth / 2;
      const cy = window.innerHeight / 2;

      if (mode === 'evade') {
        spriteAnimator.play('vanish', cx, cy, 0, defenderKey);
      } else if (mode === 'defense') {
        spriteAnimator.play('barrier', cx, cy, 0, defenderKey);
      } else {
        spriteAnimator.play('punch', cx, cy, 0, defenderKey);
      }

      this.triggerHpBarImpactFlash(defenderKey === 'player' ? 'p1-hp-bar-wrapper' : 'p2-hp-bar-wrapper', 0);
    }, 280);

    setTimeout(() => {
      overlay.style.transition = 'opacity 0.25s ease-out';
      overlay.style.opacity = '0';
      setTimeout(() => overlay.remove(), 250);
    }, 950);
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
    if (descEl) {
      const rawText = i18n.lang === 'pt' ? (card.descPt || card.description) : (card.descEn || card.description);
      descEl.textContent = (rawText || '').replace(/^\[[^\]]+\]\s*/gi, '').trim();
    }
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
      const authModal = document.getElementById('auth-modal');
      const authCloseBtn = document.getElementById('auth-close-btn');
      const userInput = document.getElementById('auth-user-input');

      if (userInput && typeof authManager !== 'undefined' && authManager.user && authManager.user.displayName) {
        userInput.value = authManager.user.displayName;
      }

      if (authModal) {
        authModal.classList.add('active');
        if (authCloseBtn) authCloseBtn.style.display = 'none';
        return; // FORCE LOGIN / SIGNUP SCREEN ON EVERY GAME START
      }

      soundEngine.playAwaken();
      sceneManager.switchScene(GAME_SCENES.MAIN_MENU);
    });

    // 3. Cinematic Intro Skip Button
    document.getElementById('intro-skip-btn')?.addEventListener('click', () => {
      soundEngine.playClick();
      sceneManager.switchScene(GAME_SCENES.MAIN_MENU);
    });

    // 4. Main Menu Mode Card Event Listeners
    document.getElementById('menu-btn-ranked-1v1')?.addEventListener('click', () => {
      soundEngine.playClick();
      this.activeGameMode = '1v1';
      this.multiplayer.startRanked1v1Matchmaking(this.selectedLeader);
    });

    document.getElementById('menu-btn-ranked-2v2')?.addEventListener('click', () => {
      soundEngine.playClick();
      this.activeGameMode = '2v2';
      this.multiplayer.startMatchmaking('2v2', this.selectedLeader);
    });

    document.getElementById('menu-btn-coop-raid')?.addEventListener('click', () => {
      soundEngine.playClick();
      this.activeGameMode = 'raid';
      this.multiplayer.startMatchmaking('raid', this.selectedLeader);
    });

    document.getElementById('menu-btn-global-ranking')?.addEventListener('click', () => {
      soundEngine.playClick();
      this.openLeaderboardModal();
    });

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
        document.getElementById('bnav-shop')?.addEventListener('click', () => {
      soundEngine.playClick();
      this.renderShop();
      sceneManager.switchScene(GAME_SCENES.SHOP);
    });

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
    this.authLoginSubmit?.addEventListener('click', async () => {
      soundEngine.playClick();
      const username = this.authUserInput?.value.trim() || 'GuerreiroZ';
      const email = username.includes('@') ? username : username.toLowerCase() + '@dbtcg.local';
      const res = await authManager.login(email, this.authPassInput?.value || '');
      if (res && res.success) { 
        this.authModal?.classList.remove('active'); 
        soundEngine.playAwaken();
        sceneManager.switchScene(GAME_SCENES.MAIN_MENU);
        const nameEl = document.getElementById('display-user-name');
        if (nameEl) nameEl.textContent = authManager.user.displayName;
      } else {
        alert(res?.message || 'Erro ao realizar login.');
      }
    });
    this.authRegisterSubmit?.addEventListener('click', async () => {
      soundEngine.playClick();
      const username = this.authUserInput?.value.trim() || 'GuerreiroZ';
      const email = username.includes('@') ? username : username.toLowerCase() + '@dbtcg.local';
      const res = await authManager.signUp(username, email, this.authPassInput?.value || '');
      if (res && res.success) { 
        this.authModal?.classList.remove('active');
        soundEngine.playAwaken();
        sceneManager.switchScene(GAME_SCENES.MAIN_MENU);
        const nameEl = document.getElementById('display-user-name');
        if (nameEl) nameEl.textContent = authManager.user.displayName;
      } else {
        alert(res?.message || 'Erro ao cadastrar conta.');
      }
    });

    this.chargeKiBtn?.addEventListener('click', () => {
      if (this.isUiLocked()) return;
      soundEngine.playClick();
      if (this.activeGameMode === '2v2') {
        const myFighterId2v2 = this._getMyFighterId('2v2');
        if (this.multiplayer.isMultiplayer && !this.multiplayer.isHost) {
          socketManager.emit('mode_action_broadcast', { mode: '2v2', action: 'chargeKi', fighterId: myFighterId2v2 });
        } else {
          // chargeKi no engine já avança o turno internamente (igual ao 1v1)
          this.mode2v2.chargeKi(myFighterId2v2);
        }
      } else if (this.activeGameMode === 'raid') {
        const myFighterIdRaid = this._getMyFighterId('raid');
        if (this.multiplayer.isMultiplayer && !this.multiplayer.isHost) {
          socketManager.emit('mode_action_broadcast', { mode: 'raid', action: 'chargeKi', fighterId: myFighterIdRaid });
        } else {
          // chargeKi no engine já avança o turno internamente (igual ao 1v1)
          this.modeRaid.chargeKi(myFighterIdRaid);
        }
      } else {
        this.gameEngine.chargeKi('player');
      }
    });

    this.passTurnBtn?.addEventListener('click', () => {
      if (this.isUiLocked()) return;
      soundEngine.playClick();
      if (this.activeGameMode === '2v2') {
        const myFighterId2v2 = this._getMyFighterId('2v2');
        if (this.multiplayer.isMultiplayer && !this.multiplayer.isHost) {
          socketManager.emit('mode_action_broadcast', { mode: '2v2', action: 'passTurn', fighterId: myFighterId2v2 });
        } else {
          this.mode2v2.passTurn(myFighterId2v2);
        }
      } else if (this.activeGameMode === 'raid') {
        const myFighterIdRaid = this._getMyFighterId('raid');
        if (this.multiplayer.isMultiplayer && !this.multiplayer.isHost) {
          socketManager.emit('mode_action_broadcast', { mode: 'raid', action: 'passTurn', fighterId: myFighterIdRaid });
        } else {
          this.modeRaid.passTurn(myFighterIdRaid);
        }
      } else {
        this.gameEngine.passTurn('player');
      }
    });

    this.clashMashBtn?.addEventListener('click', () => {
      soundEngine.playClick();
      if (this.multiplayer && this.multiplayer.isMultiplayer && !this.multiplayer.isHost) {
        const fighterId = this.activeGameMode === 'raid'
          ? this.modeRaid.activeFighterId
          : this.mode2v2.activeFighterId;
        socketManager.emit('mode_action_broadcast', {
          mode: this.activeGameMode,
          action: 'mashBeamClash',
          fighterId
        });
      } else if (this.activeGameMode === '2v2') {
        this.mode2v2.mashBeamClash(this.mode2v2.activeFighterId);
      } else if (this.activeGameMode === 'raid') {
        this.modeRaid.mashBeamClash(this.modeRaid.activeFighterId);
      } else {
        this.gameEngine.mashBeamClash();
      }
    });

    if (this.dropZone) {
      this.dropZone.addEventListener('dragover', e => {
        e.preventDefault();
        this.dropZone.classList.add('drag-over');
      });
      this.dropZone.addEventListener('dragleave', () => this.dropZone.classList.remove('drag-over'));
      this.dropZone.addEventListener('drop', e => {
        e.preventDefault();
        this.dropZone.classList.remove('drag-over');
        if (this.isUiLocked(true)) {
          this.showToast('⚠️ Ação bloqueada no momento!', 'warning');
          this.draggedCardIndex = null;
          return;
        }
        if (this.draggedCardIndex !== null) {
          const isNonHost = this.multiplayer && this.multiplayer.isMultiplayer && !this.multiplayer.isHost;
          if (this.activeGameMode === '2v2') {
            const myFighterId = this._getMyFighterId('2v2');
            if (isNonHost) {
              socketManager.emit('mode_action_broadcast', { mode: '2v2', action: 'playCard', fighterId: myFighterId, handIndex: this.draggedCardIndex, targetId: this.mode2v2.selectedTargetId });
            } else {
              // Usa myFighterId correto (não activeFighterId) para reaction window funcionar
              this.mode2v2.playCard(myFighterId, this.draggedCardIndex, this.mode2v2.selectedTargetId);
            }
          } else if (this.activeGameMode === 'raid') {
            const myFighterId = this._getMyFighterId('raid');
            if (isNonHost) {
              socketManager.emit('mode_action_broadcast', { mode: 'raid', action: 'playCard', fighterId: myFighterId, handIndex: this.draggedCardIndex });
            } else {
              this.modeRaid.playCard(myFighterId, this.draggedCardIndex);
            }
          } else {
            this.gameEngine.playCard('player', this.draggedCardIndex);
          }
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
        const chatUsername = (typeof authManager !== 'undefined' && authManager.user?.displayName) ? authManager.user.displayName : 'Guerreiro Z';
        chatManager.addMessage(chatUsername, this.chatInput.value.trim());
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
  showToast(msg, icon = '⚡') {
    const existing = document.getElementById('dbz-toast-notification');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'dbz-toast-notification';
    toast.className = 'dbz-toast-notification';
    toast.innerHTML = `<span class="toast-icon">${icon}</span> <span class="toast-text">${msg}</span>`;
    document.body.appendChild(toast);

    setTimeout(() => toast.classList.add('active'), 20);
    setTimeout(() => {
      toast.classList.remove('active');
      setTimeout(() => toast.remove(), 300);
    }, 2800);
  }

  updateUserSessionUI() {
    const user = (typeof authManager !== 'undefined' && authManager.user) ? authManager.user : authDatabase.getCurrentUser();
    const zeniVal = (user && user.zeni !== undefined && !isNaN(user.zeni)) ? user.zeni : 1500;
    const dustVal = (user && user.gems !== undefined && !isNaN(user.gems)) ? user.gems : ((user && user.dust !== undefined && !isNaN(user.dust)) ? user.dust : 300);

    deckBuilder.zeni = zeniVal;
    deckBuilder.dust = dustVal;
    this.updateCurrencies();

    const nameEl = document.getElementById('display-user-name');
    if (nameEl && user) {
      nameEl.textContent = user.displayName || user.username || 'Guerreiro Z';
    }

    if (this.authBtn && user) {
      this.authBtn.textContent = user.isGuest ? '🔑 Entrar' : `👤 ${user.displayName || user.username || 'Guerreiro'}`;
    }
  }

  updateCurrencies() {
    const user = (typeof authManager !== 'undefined' && authManager.user) ? authManager.user : authDatabase.getCurrentUser();
    const zeniVal = (user && user.zeni !== undefined && !isNaN(user.zeni)) ? user.zeni : (deckBuilder.zeni || 1500);
    const dustVal = (user && user.gems !== undefined && !isNaN(user.gems)) ? user.gems : ((user && user.dust !== undefined && !isNaN(user.dust)) ? user.dust : 300);

    if (this.zeniDisplay) this.zeniDisplay.textContent = isNaN(zeniVal) ? 1500 : zeniVal;
    if (this.dustDisplay) this.dustDisplay.textContent = isNaN(dustVal) ? 300 : dustVal;
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
    // When active mode is 2v2 or raid, the GameEngine 1v1 callback should NOT
    // trigger render2v2Arena/renderRaidArena — those are triggered by their own
    // onStateChange callbacks. Just return silently to prevent double-rendering.
    if (this.activeGameMode === '2v2') {
      return;
    }
    if (this.activeGameMode === 'raid') {
      return;
    }

    if (!engine) engine = this.gameEngine;
    const p = engine.player;
    const opp = engine.opponent;

    // Phase Banner
    if (this.turnPhaseBar) {
      this.turnPhaseBar.className = 'dbz-phase-banner';
      if (engine.state === 'ATTACK_PENDING') {
        const defending = engine.pendingAttack?.attackerKey === 'opponent';
        const hasDef = engine.hasDefensiveResponse('player');
        this.turnPhaseBar.classList.add('phase-reaction');
        if (this.turnPhaseText) {
          this.turnPhaseText.textContent = defending
            ? (hasDef ? i18n.t('reactionBannerDefending') : i18n.t('reactionBannerNoDef'))
            : i18n.t('reactionBannerInFlight');
        }
      } else if (engine.initiative === 'player') {
        this.turnPhaseBar.classList.add('phase-player');
        if (this.turnPhaseText) this.turnPhaseText.textContent = i18n.t('yourTurnBanner');
      } else {
        this.turnPhaseBar.classList.add('phase-opponent');
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
      const chargeText = p.ki >= 10 ? i18n.t('overchargeKiBtn') : i18n.t('chargeKiBtn');
      this.chargeKiBtn.innerHTML = `<span class="btn-label">${chargeText}</span>`;
    }
    if (this.passTurnBtn) {
      this.passTurnBtn.disabled = !canAct;
      const passText = i18n.t('passTurnBtn');
      this.passTurnBtn.innerHTML = `<span class="btn-label">${passText}</span>`;
    }

    // Central Drop Zone — Official DBZ Action Badge & Large Played Card
    if (this.dropZone) {
      if (engine.pendingAttack) {
        const attackerName = engine.pendingAttack.attackerKey === 'player' ? p.name : opp.name;
        const attackCard = engine.pendingAttack.card;
        const currentCardId = this.dropZone.dataset.currentCardId;
        
        if (currentCardId !== attackCard.id) {
          this.dropZone.innerHTML = `
            <div class="dbz-pending-action-badge">
              <div class="dpab-bg"></div>
              <div class="dpab-content">
                <span class="dpab-tag">[ CARTA EM CAMPO ]</span>
                <span class="dpab-title">${attackCard.name.toUpperCase()}</span>
                <span class="dpab-sub">POR ${attackerName.toUpperCase()}</span>
              </div>
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
          this.dropZone.dataset.currentCardId = attackCard.id;
        }
      } else {
        if (this.dropZone.dataset.currentCardId) {
          this.dropZone.innerHTML = '';
          this.dropZone.dataset.currentCardId = '';
        }
      }
    }

    // Reaction banner
    if (engine.state === 'ATTACK_PENDING') {
      this.reactionBanner?.classList.add('active');
    } else {
      this.reactionBanner?.classList.remove('active');
    }

    // Beam Clash
    if (engine.state === 'BEAM_CLASH' && engine.beamClashData) {
      this.beamClashOverlay?.classList.add('active');
      if (this.beamClashFill) this.beamClashFill.style.width = `${engine.beamClashData.p1Progress}%`;
      this.fx.triggerBeamClash(
        engine.beamClashData.p1Progress,
        engine.player?.leader?.color || '#00f2fe',
        engine.opponent?.leader?.color || '#ffd700'
      );
    } else {
      this.beamClashOverlay?.classList.remove('active');
      if (this.fx && this.fx.activeClash) this.fx.activeClash = null;
    }

        // Beam Clash Button & Overlay
    const mashBtn = document.getElementById('clash-mash-btn');
    if (mashBtn) {
      mashBtn.style.display = engine.state === 'BEAM_CLASH' ? 'inline-block' : 'none';
    }

    // Hand
    this.renderPlayerHand(p.hand, p.ki, engine.state, engine.initiative, engine.pendingAttack, p.isOpenGuard, 'p1');

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

  /* ── 2v2 Ranked Arena Renderer (2 Top vs 2 Bottom Side-by-Side) ────── */
  render2v2Arena(state) {
    if (this.activeGameMode !== '2v2' || !state || !state.fighters) return;
    const fighters = state.fighters;

    // Determine my fighter and which team I'm on
    let myFighterId = 'p1';
    if (this.multiplayer && this.multiplayer.isMultiplayer && !this.multiplayer.isHost) {
      if (this.multiplayer.guestIndex === 1) myFighterId = 'p2';
      else if (this.multiplayer.guestIndex === 2) myFighterId = 'opp1';
      else if (this.multiplayer.guestIndex === 3) myFighterId = 'opp2';
    }
    const myTeam = fighters[myFighterId]?.team || 'A';
    // Bottom shows allies (my team), top shows enemies (opposing team)
    const allyAId = myTeam === 'A' ? 'p1' : 'opp1';
    const allyBId = myTeam === 'A' ? 'p2' : 'opp2';
    const enemyAId = myTeam === 'A' ? 'opp1' : 'p1';
    const enemyBId = myTeam === 'A' ? 'opp2' : 'p2';

    const topArea = document.querySelector('.arena-zone-top');
    if (topArea) {
      topArea.innerHTML = `
        <div class="team-row-2v2">
          <div id="hud-enemy-${enemyAId}" class="hud-compact-2v2 ${state.selectedTargetId === enemyAId ? 'is-targeted' : ''} ${state.activeFighterId === enemyAId ? 'active-turn-glow' : ''}">
            ${state.selectedTargetId === enemyAId ? '<div class="target-badge-indicator">[ ALVO ]</div>' : ''}
            <div class="hud-compact-portrait">
              <img src="assets/leaders/${fighters[enemyAId].leaderKey}.png" alt="${fighters[enemyAId].name}" onerror="this.src='assets/leaders/goku.png';" style="width:100%;height:100%;object-fit:cover;">
            </div>
            <div class="hud-compact-info">
              <div class="hud-compact-name" style="color:${fighters[enemyAId].color}">${fighters[enemyAId].name}</div>
              <div style="font-size:0.65rem;color:#ffd700;font-weight:700;">HP: ${fighters[enemyAId].hp}/${fighters[enemyAId].maxHp} | KI: ${fighters[enemyAId].ki}</div>
              <div style="font-size:0.6rem;color:#00ffff;">🛡️ ESCUDOS: ${fighters[enemyAId].shields}</div>
            </div>
          </div>
          <div id="hud-enemy-${enemyBId}" class="hud-compact-2v2 ${state.selectedTargetId === enemyBId ? 'is-targeted' : ''} ${state.activeFighterId === enemyBId ? 'active-turn-glow' : ''}">
            ${state.selectedTargetId === enemyBId ? '<div class="target-badge-indicator">[ ALVO ]</div>' : ''}
            <div class="hud-compact-portrait">
              <img src="assets/leaders/${fighters[enemyBId].leaderKey}.png" alt="${fighters[enemyBId].name}" onerror="this.src='assets/leaders/goku.png';" style="width:100%;height:100%;object-fit:cover;">
            </div>
            <div class="hud-compact-info">
              <div class="hud-compact-name" style="color:${fighters[enemyBId].color}">${fighters[enemyBId].name}</div>
              <div style="font-size:0.65rem;color:#ffd700;font-weight:700;">HP: ${fighters[enemyBId].hp}/${fighters[enemyBId].maxHp} | KI: ${fighters[enemyBId].ki}</div>
              <div style="font-size:0.6rem;color:#00ffff;">🛡️ ESCUDOS: ${fighters[enemyBId].shields}</div>
            </div>
          </div>
        </div>
      `;
      topArea.querySelector(`#hud-enemy-${enemyAId}`)?.addEventListener('click', () => this.mode2v2.setTarget(enemyAId));
      topArea.querySelector(`#hud-enemy-${enemyBId}`)?.addEventListener('click', () => this.mode2v2.setTarget(enemyBId));
    }

    const botLeaderBox = document.getElementById('p1-leader-box');
    if (botLeaderBox) {
      botLeaderBox.innerHTML = `
        <div class="team-row-2v2" style="width:100%;">
          <div class="hud-compact-2v2 ${state.activeFighterId === allyAId ? 'active-turn-glow' : ''}">
            <div class="hud-compact-portrait">
              <img src="assets/leaders/${fighters[allyAId].leaderKey}.png" alt="${fighters[allyAId].name}" onerror="this.src='assets/leaders/goku.png';" style="width:100%;height:100%;object-fit:cover;">
            </div>
            <div class="hud-compact-info">
              <div class="hud-compact-name" style="color:${fighters[allyAId].color}">${fighters[allyAId].name}</div>
              <div style="font-size:0.65rem;color:#ffd700;font-weight:700;">HP: ${fighters[allyAId].hp}/${fighters[allyAId].maxHp} | KI: ${fighters[allyAId].ki}</div>
              <div style="font-size:0.6rem;color:#00ffff;">🛡️ ESCUDOS: ${fighters[allyAId].shields}</div>
            </div>
          </div>
          <div class="hud-compact-2v2 ${state.activeFighterId === allyBId ? 'active-turn-glow' : ''}">
            <div class="hud-compact-portrait">
              <img src="assets/leaders/${fighters[allyBId].leaderKey}.png" alt="${fighters[allyBId].name}" onerror="this.src='assets/leaders/goku.png';" style="width:100%;height:100%;object-fit:cover;">
            </div>
            <div class="hud-compact-info">
              <div class="hud-compact-name" style="color:${fighters[allyBId].color}">${fighters[allyBId].name}</div>
              <div style="font-size:0.65rem;color:#ffd700;font-weight:700;">HP: ${fighters[allyBId].hp}/${fighters[allyBId].maxHp} | KI: ${fighters[allyBId].ki}</div>
              <div style="font-size:0.6rem;color:#00ffff;">🛡️ ESCUDOS: ${fighters[allyBId].shields}</div>
            </div>
          </div>
        </div>
      `;
    }

    const canAct = state.activeFighterId === myFighterId && state.state === 'FREE_ACTION';
    // Reação: o defensor também pode jogar cartas durante ATTACK_PENDING
    const isDefender = state.state === 'ATTACK_PENDING' && state.pendingAttack?.targetId === myFighterId;
    if (this.passTurnBtn) this.passTurnBtn.disabled = !canAct;
    if (this.chargeKiBtn) this.chargeKiBtn.disabled = !canAct;

    // Banner de turno — mostra quem é o lutador ativo
    if (this.turnPhaseBar) {
      this.turnPhaseBar.className = 'dbz-phase-banner';
      const activeFighter = fighters[state.activeFighterId];
      if (state.state === 'ATTACK_PENDING') {
        this.turnPhaseBar.classList.add('phase-reaction');
        if (this.turnPhaseText) {
          this.turnPhaseText.textContent = isDefender
            ? '⚡ SEU TURNO DE REAGIR! (3s)'
            : `⚡ ${fighters[state.pendingAttack?.attackerId]?.name || ''} ATACOU! Janela de Reação...`;
        }
      } else if (state.state === 'BEAM_CLASH') {
        this.turnPhaseBar.classList.add('phase-reaction');
        if (this.turnPhaseText) this.turnPhaseText.textContent = '🔥 DISPUTA DE BEAM! Pressione!';
      } else if (canAct) {
        this.turnPhaseBar.classList.add('phase-player');
        if (this.turnPhaseText) this.turnPhaseText.textContent = `✅ SEU TURNO! Jogue uma carta ou carregue Ki.`;
      } else {
        this.turnPhaseBar.classList.add('phase-opponent');
        if (this.turnPhaseText) this.turnPhaseText.textContent = `⏳ Turno de ${activeFighter?.name || state.activeFighterId}...`;
      }
    }

    // Render Played Card in Drop Zone for 2v2
    if (this.dropZone) {
      if (state.pendingAttack && state.pendingAttack.card) {
        const attackCard = state.pendingAttack.card;
        const attackerName = state.fighters[state.pendingAttack.attackerId]?.name || 'Guerreiro';
        this.dropZone.innerHTML = `
          <div class="dbz-pending-action-badge">
            <div class="dpab-bg"></div>
            <div class="dpab-content">
              <span class="dpab-tag">[ CARTA EM CAMPO ]</span>
              <span class="dpab-title">${attackCard.name.toUpperCase()}</span>
              <span class="dpab-sub">POR ${attackerName.toUpperCase()}</span>
            </div>
          </div>
          <div class="played-card-slot">
            <div class="card type-${attackCard.type}${attackCard.rarity === 'super-rare' ? ' super-rare' : ''}">
              ${assetLoader.renderCardArtHTML(attackCard)}
              <div class="card-header"><div class="card-ki-cost">${attackCard.cost || 0}</div></div>
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

    // Beam Clash UI for 2v2
    if (state.state === 'BEAM_CLASH' && state.beamClashData) {
      this.beamClashOverlay?.classList.add('active');
      if (this.beamClashFill) this.beamClashFill.style.width = `${state.beamClashData.p1Progress}%`;
      const atkColor = fighters[state.pendingAttack?.attackerId]?.color || '#00f2fe';
      const defColor = fighters[state.pendingAttack?.targetId]?.color || '#ffd700';
      this.fx.triggerBeamClash(state.beamClashData.p1Progress, atkColor, defColor);
    } else {
      this.beamClashOverlay?.classList.remove('active');
      if (this.fx && this.fx.activeClash) this.fx.activeClash = null;
    }
    const mashBtn2v2 = document.getElementById('clash-mash-btn');
    if (mashBtn2v2) mashBtn2v2.style.display = state.state === 'BEAM_CLASH' ? 'inline-block' : 'none';

    // Reaction banner
    if (state.state === 'ATTACK_PENDING') {
      this.reactionBanner?.classList.add('active');
    } else {
      this.reactionBanner?.classList.remove('active');
    }

    // Renderiza a mão do jogador local com isDefender correto
    const myFighter = fighters[myFighterId];
    const initForHand = (canAct || isDefender) ? 'player' : 'opponent';
    this.renderPlayerHand(myFighter.hand, myFighter.ki, state.state, initForHand, state.pendingAttack, myFighter.isOpenGuard || false, myFighterId);

    // Logs do modo 2v2
    if (state.battleLogs) this.renderLogs(state.battleLogs);

    // Game Over
    if (state.state === 'GAME_OVER') {
      this.koModal?.classList.add('active');
      if (this.koText) {
        const myTeamWon = state.winner === (fighters[myFighterId]?.team === 'A' ? 'Team A' : 'Team B');
        if (myTeamWon) {
          soundEngine.playAwaken();
          this.koText.textContent = '🏆 K.O.! VITÓRIA DO SEU TIME!';
        } else {
          this.koText.textContent = '💀 K.O.! SEU TIME FOI DERROTADO...';
        }
      }
    }
  }

  /* ── Raid Co-Op Arena Renderer (1 Boss Top, 4 Players Grid 2x2 Bottom) ── */
  renderRaidArena(state) {
    if (this.activeGameMode !== 'raid' || !state || !state.boss || !state.players) return;
    const boss = state.boss;
    const players = state.players;

    const topArea = document.querySelector('.arena-zone-top');
    if (topArea) {
      const hpPct = Math.max(0, (boss.hp / boss.maxHp) * 100);
      topArea.innerHTML = `
        <div class="boss-hud-frame ${boss.isEnraged ? 'enraged' : ''}">
          <div class="boss-portrait-box">
            <img src="${boss.portrait}" alt="${boss.name}" onerror="this.src='assets/leaders/frieza_awaken.png';" style="width:100%;height:100%;object-fit:cover;">
          </div>
          <div class="boss-info-box">
            <div class="boss-name-title">
              <span>🐉 ${boss.name.toUpperCase()}</span>
              <span>${boss.hp} / ${boss.maxHp} HP</span>
            </div>
            <div class="boss-hp-bar">
              <div class="boss-hp-fill" style="width: ${hpPct}%"></div>
            </div>
            <div style="font-size:0.68rem;color:#ff8c00;font-weight:800;">
              ${boss.isEnraged ? '🔥 EM FÚRIA ABSOLUTA! DANO MULTIPLICADO' : '⚡ KI RECARREGANDO PARA ATAQUE ESPECIAL'}
            </div>
          </div>
        </div>
      `;
    }

    const botLeaderBox = document.getElementById('p1-leader-box');
    if (botLeaderBox) {
      botLeaderBox.innerHTML = `
        <div class="players-grid-2x2" style="width:100%;">
          ${Object.values(players).map(p => `
            <div class="mini-player-hud ${state.activeFighterId === p.id ? 'active-turn' : ''}">
              <img src="assets/leaders/${p.leaderKey}.png" alt="${p.name}" onerror="this.src='assets/leaders/goku.png';" style="width:34px;height:34px;border-radius:50%;border:1.5px solid ${p.color};">
              <div style="display:flex;flex-direction:column;gap:1px;flex:1;min-width:0;">
                <div style="font-size:0.68rem;font-weight:900;color:${p.color};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${p.name}</div>
                <div style="font-size:0.6rem;color:#ffd700;">HP: ${p.hp}/${p.maxHp}</div>
                <div style="font-size:0.55rem;color:#00ffff;">🛡️ ESCUDO: ${p.shields} | KI: ${p.ki}</div>
              </div>
            </div>
          `).join('')}
        </div>
      `;
    }

    let myFighterId = this._getMyFighterId('raid');

    const canAct = state.activeFighterId === myFighterId && state.state === 'FREE_ACTION';
    // Reação: o defensor pode jogar cartas durante a fase do boss
    const isDefenderRaid = state.state === 'ATTACK_PENDING' && state.pendingAttack?.targetId === myFighterId;
    if (this.passTurnBtn) this.passTurnBtn.disabled = !canAct;
    if (this.chargeKiBtn) this.chargeKiBtn.disabled = !canAct;

    // Banner de turno para Raid
    if (this.turnPhaseBar) {
      this.turnPhaseBar.className = 'dbz-phase-banner';
      const activeFighter = state.activeFighterId === 'boss' ? boss : players[state.activeFighterId];
      if (state.state === 'ATTACK_PENDING' || state.state === 'BOSS_PHASE') {
        this.turnPhaseBar.classList.add('phase-reaction');
        if (this.turnPhaseText) {
          this.turnPhaseText.textContent = isDefenderRaid
            ? `⚡ ${boss.name} ATACA VOCÊ! (3s para reagir)`
            : (state.state === 'BOSS_PHASE' ? `⚠️ FASE DO CHEFE: ${boss.name}!` : `⚡ Janela de Reação...`);
        }
      } else if (state.state === 'BEAM_CLASH') {
        this.turnPhaseBar.classList.add('phase-reaction');
        if (this.turnPhaseText) this.turnPhaseText.textContent = '🔥 DISPUTA DE BEAM! Pressione!';
      } else if (canAct) {
        this.turnPhaseBar.classList.add('phase-player');
        if (this.turnPhaseText) this.turnPhaseText.textContent = `✅ SEU TURNO! Ataque o Chefe!`;
      } else {
        this.turnPhaseBar.classList.add('phase-opponent');
        if (this.turnPhaseText) this.turnPhaseText.textContent = `⏳ Turno de ${activeFighter?.name || state.activeFighterId}...`;
      }
    }

    // Reaction banner
    if (state.state === 'ATTACK_PENDING' || state.state === 'BOSS_PHASE') {
      this.reactionBanner?.classList.add('active');
    } else {
      this.reactionBanner?.classList.remove('active');
    }

    // Render Played Card in Drop Zone for Raid
    if (this.dropZone) {
      if (state.pendingAttack && state.pendingAttack.card) {
        const attackCard = state.pendingAttack.card;
        const attackerName = state.players[state.pendingAttack.attackerId]?.name || 'Guerreiro Z';
        this.dropZone.innerHTML = `
          <div class="dbz-pending-action-badge">
            <div class="dpab-bg"></div>
            <div class="dpab-content">
              <span class="dpab-tag">[ CARTA EM CAMPO ]</span>
              <span class="dpab-title">${attackCard.name.toUpperCase()}</span>
              <span class="dpab-sub">POR ${attackerName.toUpperCase()}</span>
            </div>
          </div>
          <div class="played-card-slot">
            <div class="card type-${attackCard.type}${attackCard.rarity === 'super-rare' ? ' super-rare' : ''}">
              ${assetLoader.renderCardArtHTML(attackCard)}
              <div class="card-header"><div class="card-ki-cost">${attackCard.cost || 0}</div></div>
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
    // Beam Clash UI for Raid
    if (state.state === 'BEAM_CLASH' && state.beamClashData) {
      this.beamClashOverlay?.classList.add('active');
      if (this.beamClashFill) this.beamClashFill.style.width = `${state.beamClashData.p1Progress}%`;
      const atkColor = players[state.pendingAttack?.attackerId]?.color || '#00f2fe';
      const defColor = '#ff0055';
      this.fx.triggerBeamClash(state.beamClashData.p1Progress, atkColor, defColor);
    } else {
      this.beamClashOverlay?.classList.remove('active');
      if (this.fx && this.fx.activeClash) this.fx.activeClash = null;
    }
    const mashBtnRaid = document.getElementById('clash-mash-btn');
    if (mashBtnRaid) mashBtnRaid.style.display = state.state === 'BEAM_CLASH' ? 'inline-block' : 'none';


    this.renderPlayerHand(
      players[myFighterId].hand,
      players[myFighterId].ki,
      state.state,
      (canAct || isDefenderRaid) ? 'player' : 'opponent',
      state.pendingAttack,
      false,
      myFighterId
    );

    // Logs do modo Raid
    if (state.battleLogs) this.renderLogs(state.battleLogs);

    // Game Over
    if (state.state === 'GAME_OVER') {
      this.koModal?.classList.add('active');
      if (this.koText) {
        const playerWon = state.winner === 'Team Z (Players)';
        if (playerWon) {
          soundEngine.playAwaken();
          this.koText.textContent = '🏆 RAID VENCIDA! Chefe Derrotado!';
        } else {
          this.koText.textContent = '💀 DERROTA NA RAID... Guerreiros Derrotados.';
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
      portrait.innerHTML = assetLoader.renderLeaderPortraitHTML(fighter.leader, fighter.isAwakened);
      portrait.classList.toggle('awakened', fighter.isAwakened);
    }

    this.renderFighterCanvas(prefix, fighter);

    this.renderShields(shields, fighter.shields);
    this.renderKiGauge(kiSlots, kiText, fighter.ki);
    if (leaderBox) leaderBox.classList.toggle('open-guard', fighter.isOpenGuard);
  }

  startFighterSpriteLoop() {
    setInterval(() => {
      // Only render 1v1 sprites when in 1v1 mode — prevents ghost rendering
      // in 2v2/raid modes that reconstruct the arena DOM
      if (this.activeGameMode !== '1v1') return;
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
  renderPlayerHand(hand, playerKi, gameState, initiative, pendingAttack, isOpenGuard, myFighterId) {
    if (!this.p1HandContainer) return;
    
    const resolvedHand = (hand || []).slice(0, 7).map(c => typeof c === 'string' ? getCardById(c) : c).filter(Boolean);

    const pHash = pendingAttack ? (pendingAttack.targetId || pendingAttack.attackerId || 'pending') : 'none';
    const renderHash = resolvedHand.map(c => c.id || c.name || '').join(',') + `|${playerKi}|${gameState}|${initiative}|${isOpenGuard}|${pHash}`;
    if (this.p1HandContainer.dataset.renderHash === renderHash) return;
    this.p1HandContainer.dataset.renderHash = renderHash;

    this.p1HandContainer.innerHTML = '';

    if (gameState === 'BEAM_CLASH' || gameState === 'GAME_OVER') {
      this.p1HandContainer.classList.add('hand-locked');
    } else {
      this.p1HandContainer.classList.remove('hand-locked');
    }

    resolvedHand.forEach((card, index) => {
      const el = document.createElement('div');
      const cardType = card.type || 'attack';

      let isPlayable = false;
      let reasonText = '';

      if (gameState === 'BEAM_CLASH' || gameState === 'GAME_OVER') {
        isPlayable = false;
        reasonText = 'Disputa de Feixe de Ki em andamento!';
      } else if (playerKi < (card.cost || 0)) {
        reasonText = i18n.t('reasonNeedKi');
      } else if (cardType === 'evade' && isOpenGuard) {
        reasonText = i18n.t('reasonOpenGuard');
      } else if (gameState === 'FREE_ACTION' && initiative === 'player') {
        if (cardType === 'attack' || cardType === 'tech' || cardType === 'support' || cardType === 'ki_blast') isPlayable = true;
        else reasonText = i18n.t('reasonDefenseOnly');
      } else if (gameState === 'ATTACK_PENDING' && pendingAttack) {
        const attackerKey = pendingAttack.attackerKey || pendingAttack.attackerId || 'player';
        const isAttacker = attackerKey === 'player' || (myFighterId && attackerKey === myFighterId);
        if (isAttacker) {
          isPlayable = false;
          reasonText = 'Aguardando resposta do oponente ao seu ataque...';
        } else {
          const targetFighterId = pendingAttack.targetId || 'p1';
          const isTargeted = targetFighterId === (myFighterId || 'p1');
          if (isTargeted) {
            if (['defense', 'evade', 'counter'].includes(cardType) || card.isBeam) isPlayable = true;
            else reasonText = i18n.t('reasonReactionOnly');
          } else {
            reasonText = i18n.t('reasonInFlight');
          }
        }
      } else if (initiative !== 'player') {
        reasonText = i18n.t('reasonOpponentTurn');
      }

      el.className = `card type-${cardType}${card.rarity === 'super-rare' ? ' super-rare' : ''} ${isPlayable ? 'playable' : 'unplayable'}`;

      el.innerHTML = assetLoader.renderCardHTML(card);

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

      el.addEventListener('click', (e) => {
        e.preventDefault();
        const now = Date.now();
        if (this.lastCardClickTime && (now - this.lastCardClickTime < 500)) {
          return; // Debounce rapid clicks
        }

        if (this.isUiLocked(true)) {
          this.showToast('⚠️ Ação bloqueada no momento!', 'warning');
          return;
        }

        this.lastCardClickTime = now;

        if (isPlayable) {
          soundEngine.playClick();
          soundEngine.playCardPlay();
          if (this.activeGameMode === '2v2') {
            const myFighterId = this._getMyFighterId('2v2');
            if (this.multiplayer.isMultiplayer && !this.multiplayer.isHost) {
              socketManager.emit('mode_action_broadcast', { mode: '2v2', action: 'playCard', fighterId: myFighterId, handIndex: index, targetId: this.mode2v2.selectedTargetId });
            } else {
              // USA myFighterId (não activeFighterId) para reaction window funcionar corretamente
              this.mode2v2.playCard(myFighterId, index, this.mode2v2.selectedTargetId);
            }
          } else if (this.activeGameMode === 'raid') {
            const myFighterId = this._getMyFighterId('raid');
            if (this.multiplayer.isMultiplayer && !this.multiplayer.isHost) {
              socketManager.emit('mode_action_broadcast', { mode: 'raid', action: 'playCard', fighterId: myFighterId, handIndex: index });
            } else {
              this.modeRaid.playCard(myFighterId, index);
            }
          } else {
            this.gameEngine.playCard('player', index);
          }
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

  /* ── Helper: ID do lutador local (centraliza lógica de guestIndex) ─── */
  _getMyFighterId(mode) {
    if (mode === '2v2') {
      if (this.multiplayer && this.multiplayer.isMultiplayer && !this.multiplayer.isHost) {
        if (this.multiplayer.guestIndex === 1) return 'p2';
        if (this.multiplayer.guestIndex === 2) return 'opp1';
        if (this.multiplayer.guestIndex === 3) return 'opp2';
      }
      return 'p1';
    } else if (mode === 'raid') {
      if (this.multiplayer && this.multiplayer.isMultiplayer && !this.multiplayer.isHost) {
        if (this.multiplayer.guestIndex === 1) return 'p2';
        if (this.multiplayer.guestIndex === 2) return 'p3';
        if (this.multiplayer.guestIndex === 3) return 'p4';
      }
      return 'p1';
    }
    return 'player';
  }

  /* ── UI Interaction Lock ───────────────────────────────────────────── */
  isUiLocked(checkBeamClash = false) {
    if (this.activeGameMode === '1v1') {
      if (this.gameEngine && this.gameEngine.isActionProcessing) return true;
      if (checkBeamClash && this.gameEngine && this.gameEngine.state === 'BEAM_CLASH') return true;
      if (this.gameEngine && this.gameEngine.state === 'GAME_OVER') return true;
      if (this.gameEngine && this.gameEngine.state === 'ATTACK_PENDING' && this.gameEngine.pendingAttack?.attackerKey === 'player') return true;
    } else if (this.activeGameMode === '2v2') {
      if (this.mode2v2 && this.mode2v2._isAdvancingTurn) return true;
      if (checkBeamClash && this.mode2v2 && this.mode2v2.state === 'BEAM_CLASH') return true;
      if (this.mode2v2 && this.mode2v2.state === 'GAME_OVER') return true;
      if (this.mode2v2 && this.mode2v2.state === 'ATTACK_PENDING' && this.mode2v2.pendingAttack?.attackerId === this._getMyFighterId('2v2')) return true;
    } else if (this.activeGameMode === 'raid') {
      if (this.modeRaid && this.modeRaid._isAdvancingTurn) return true;
      if (this.modeRaid && this.modeRaid._isBossActing) return true;
      if (checkBeamClash && this.modeRaid && this.modeRaid.state === 'BEAM_CLASH') return true;
      if (this.modeRaid && this.modeRaid.state === 'GAME_OVER') return true;
      if (this.modeRaid && this.modeRaid.state === 'ATTACK_PENDING' && this.modeRaid.pendingAttack?.attackerId === this._getMyFighterId('raid')) return true;
    }
    return false;
  }

  /* ── Cleanup Inactive Mode Engines ─────────────────────────────────── */
  cleanupInactiveModes(activeMode) {
    // Kill all timers/intervals in mode engines that are NOT the active mode
    // This prevents ghost AI actions and state leaks between modes
    if (activeMode !== '2v2' && this.mode2v2) {
      if (this.mode2v2.aiTurnTimeout) {
        clearTimeout(this.mode2v2.aiTurnTimeout);
        this.mode2v2.aiTurnTimeout = null;
      }
      if (this.mode2v2.reactionTimer) {
        clearInterval(this.mode2v2.reactionTimer);
        this.mode2v2.reactionTimer = null;
      }
      this.mode2v2.clearBeamClashLoop();
      this.mode2v2.winner = null;
      this.mode2v2.state = 'FREE_ACTION';
      this.mode2v2.pendingAttack = null;
    }
    if (activeMode !== 'raid' && this.modeRaid) {
      if (this.modeRaid.aiTurnTimeout) {
        clearTimeout(this.modeRaid.aiTurnTimeout);
        this.modeRaid.aiTurnTimeout = null;
      }
      if (this.modeRaid.reactionTimer) {
        clearInterval(this.modeRaid.reactionTimer);
        this.modeRaid.reactionTimer = null;
      }
      this.modeRaid.clearBeamClashLoop();
      this.modeRaid.winner = null;
      this.modeRaid.state = 'FREE_ACTION';
      this.modeRaid.pendingAttack = null;
    }
    if (activeMode !== '1v1' && this.gameEngine) {
      this.gameEngine.reset();
    }
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
        row.className = 'deck-entry-capsule';
        row.innerHTML = `
          <div class="de-capsule-info">
            <span class="de-ki-badge">⚡ ${card.cost} KI</span>
            <span class="de-card-name">${card.name}</span>
          </div>
          <button class="de-remove-btn" title="Remover carta">✕</button>
        `;
        row.querySelector('.de-capsule-info').onclick = () => this.openCardInspectModal(card);
        row.querySelector('.de-remove-btn').onclick = (e) => {
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
        el.innerHTML = assetLoader.renderCardHTML(card);
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
      el.innerHTML = assetLoader.renderCardHTML(card);
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

  
  openCardInspectModal(card) {
    if (!card) return;
    const modal = document.getElementById('card-inspect-modal');
    const container = document.getElementById('card-inspect-container');
    const info = document.getElementById('card-inspect-info');
    const closeBtn = document.getElementById('close-card-inspect-btn');

    if (container) {
      container.innerHTML = `
        <div class="card type-${card.type || 'attack'} ${card.rarity === 'super-rare' ? 'super-rare' : ''} ${card.isBeam ? 'is-beam' : ''} ${card.isFoil ? 'is-foil' : ''}" style="width: 320px !important; height: 448px !important; min-width: 320px !important; min-height: 448px !important; aspect-ratio: 160 / 224 !important;">
          ${assetLoader.renderCardHTML(card)}
        </div>
      `;
    }

    if (info) {
      const desc = (i18n.lang === 'pt' ? card.descPt : card.descEn) || card.description || '';
      info.innerHTML = `
        <div style="font-weight: 900; color: #ffd700; font-size: 1rem; margin-bottom: 4px;">${card.name.toUpperCase()}</div>
        <div style="font-weight: 800; color: #38bdf8; font-size: 0.78rem; margin-bottom: 8px;">TIPO: ${(card.isBeam ? 'BEAM CLASH' : card.type).toUpperCase()} | CUSTO: ⚡ ${card.cost} KI ${card.power ? `| PODER: ${card.power} ATK` : ''}</div>
        <div>${desc}</div>
      `;
    }

    if (closeBtn) closeBtn.onclick = () => modal?.classList.remove('active');
    if (modal) modal.classList.add('active');
  }

  openLeaderboardModal() {
    const lbModal = document.getElementById('leaderboard-modal');
    const lbContainer = document.getElementById('lb-list-container');
    if (lbModal) {
      const topList = leaderboardManager.getTopRankings();
      if (lbContainer) {
        lbContainer.innerHTML = topList.map(item => `
          <div class="lb-item ${item.isCurrent ? 'is-current' : ''}">
            <div class="lb-rank">#${item.rank}</div>
            <div class="lb-user-info">
              <div class="lb-name">${item.name}</div>
              <div class="lb-division">${item.division}</div>
            </div>
            <div class="lb-rp">⚡ ${item.rp} RP (${item.wins}V)</div>
          </div>
        `).join('');
      }
      lbModal.classList.add('active');
    }
  }

  setupAuthAndLeaderboardHandlers() {
    // Live Realtime Chat Listener — updates chat-feed in real time
    if (typeof chatManager !== 'undefined') {
      chatManager.onMessageCallback = (msg) => {
        if (this.chatFeed) {
          const bubble = document.createElement('div');
          bubble.className = 'chat-bubble';
          bubble.innerHTML = `<span class="cb-user">${msg.user}</span><span class="cb-time">${msg.time}</span><br>${msg.text}`;
          this.chatFeed.appendChild(bubble);
          this.chatFeed.scrollTop = this.chatFeed.scrollHeight;
        }
      };
    }
    const authBtn = document.getElementById('auth-btn');
    const authModal = document.getElementById('auth-modal');
    const authCloseBtn = document.getElementById('auth-close-btn');
    const authForm = document.getElementById('auth-form');

    const bnavRanked = document.getElementById('bnav-ranked');
    const lbModal = document.getElementById('leaderboard-modal');
    const lbCloseBtn = document.getElementById('lb-close-btn');
    const lbContainer = document.getElementById('lb-list-container');

    if (authModal) {
      if (!authManager.isLoggedIn) {
        authModal.classList.add('active');
      }
    }

    if (authBtn && authModal) {
      authBtn.addEventListener('click', () => {
        authModal.classList.add('active');
      });
    }

    if (authCloseBtn && authModal) {
      authCloseBtn.addEventListener('click', () => {
        if (!authManager.isLoggedIn) {
          alert('Atenção: É necessário criar uma conta ou fazer login para acessar o jogo!');
          authModal.classList.add('active');
        } else {
          authModal.classList.remove('active');
        }
      });
    }

    if (authForm) {
      authForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const username = document.getElementById('auth-username')?.value || 'Guerreiro Z';
        const email = document.getElementById('auth-email')?.value || 'guerreiro@dbtcg.com';
        const pass = document.getElementById('auth-password')?.value || '123456';
        authManager.signUp(username, email, pass);
        const nameEl = document.getElementById('display-user-name');
        if (nameEl) nameEl.textContent = authManager.user.displayName;
        if (authModal) authModal.classList.remove('active');
        this.triggerActionBanner(`CONTA SALVA: ${authManager.user.displayName}`, 'act-attack', 'ACCOUNT READY');
      });
    }

    if (bnavRanked && lbModal) {
      bnavRanked.addEventListener('click', () => {
        const topList = leaderboardManager.getTopRankings();
        if (lbContainer) {
          lbContainer.innerHTML = topList.map(item => `
            <div class="lb-item ${item.isCurrent ? 'is-current' : ''}">
              <div class="lb-rank">#${item.rank}</div>
              <div class="lb-user-info">
                <div class="lb-name">${item.name}</div>
                <div class="lb-division">${item.division}</div>
              </div>
              <div class="lb-rp">⚡ ${item.rp} RP (${item.wins}V)</div>
            </div>
          `).join('');
        }
        lbModal.classList.add('active');
      });
    }

    if (lbCloseBtn && lbModal) {
      lbCloseBtn.addEventListener('click', () => {
        lbModal.classList.remove('active');
      });
    }
  }

}

export const uiManager = new UIManager();
