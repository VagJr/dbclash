/* ==========================================================================
   Dragon Ball Clash Action TCG - Real-time Raid Client State + HUD
   ========================================================================== */

import { getEffectiveCardCost, canUseReaction } from './content-rules.js';
import { assetLoader } from './asset-loader.js';
import { RAID_BOSSES, RAID_MAX_PLAYERS, RAID_QUEUE_FILL_MS } from './raid-rules.js';
import { escapeHtml } from './safe-dom.js';

export class RaidEngine {
  constructor() {
    this.state = null;
    this.activeRaid = false;
    this.actionHandler = null;
    this.cancelHandler = null;
    this.overlay = null;
    this.clockTimer = null;
    this.latestStateVersion = -1;
    this.keyHandler = event => {
      if (event.code === 'Space' && !event.repeat && this.activeRaid && this.state?.you?.beamClash && !['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target?.tagName)) {
        event.preventDefault();
        this.actionHandler?.('mashBeamClash', {});
      }
    };
  }

  setNetworkHandlers({ action, cancel } = {}) {
    this.actionHandler = typeof action === 'function' ? action : null;
    this.cancelHandler = typeof cancel === 'function' ? cancel : null;
  }

  ensureOverlay() {
    if (typeof document === 'undefined') return null;
    if (this.overlay?.isConnected) return this.overlay;
    let overlay = document.getElementById('raid-mode-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'raid-mode-overlay';
      overlay.style.cssText = [
        'position:fixed','inset:0','z-index:25000',
        'background:radial-gradient(circle at top,#25120b 0%,#090b13 52%,#03050a 100%)',
        'color:#fff','overflow:auto','padding:24px','font-family:Inter,Arial,sans-serif'
      ].join(';');
      document.body.appendChild(overlay);
    }
    this.overlay = overlay;
    return overlay;
  }

  _ensureClock() {
    if (this.clockTimer) return;
    this.clockTimer = setInterval(() => {
      if (this.state && this.activeRaid) this.render();
    }, 500);
  }

  showQueue(bossId = 'cell_max', count = 1) {
    this.reset();
    this.activeRaid = false;
    const boss = RAID_BOSSES[bossId] || RAID_BOSSES.cell_max;
    const overlay = this.ensureOverlay();
    if (!overlay) return;

    overlay.innerHTML = `
      <div style="max-width:760px;margin:10vh auto;text-align:center;">
        <div style="font-size:12px;font-weight:900;color:#ffd166;letter-spacing:.2em;">RAID MATCHMAKING</div>
        <h1 style="font-size:42px;margin:10px 0;">${escapeHtml(boss.name)}</h1>
        <p>Buscando jogadores por ${Math.round(RAID_QUEUE_FILL_MS / 1000)} segundos. Depois, CPUs completam a esquadra.</p>
        <div style="font-size:64px;font-weight:900;margin:34px 0;">${count}/${RAID_MAX_PLAYERS}</div>
        <p style="opacity:.75;">Voce pode iniciar sozinho. O Raid sempre entra com ate 4 aliados ativos simultaneamente.</p>
        <button id="raid-cancel-queue" style="padding:12px 22px;font-weight:900;">CANCELAR BUSCA</button>
      </div>`;

    overlay.querySelector('#raid-cancel-queue')?.addEventListener('click', () => {
      this.cancelHandler?.();
      this.reset();
    });
  }

  applyServerState(state) {
    if (!state) return;
    if (this.state?.matchId && state.matchId && this.state.matchId !== state.matchId) return;
    const version = Number(state.stateVersion);
    if (Number.isFinite(version) && version < this.latestStateVersion) return;
    if (Number.isFinite(version)) this.latestStateVersion = version;
    this.state = state;
    this.receivedAt = Date.now();
    this.activeRaid = state.state === 'ACTIVE';
    this.render();
    this._ensureClock();
    if (typeof window !== 'undefined') window.addEventListener('keydown', this.keyHandler);
  }

  showResult(payload) {
    if (payload?.state) this.state = payload.state;
    this.activeRaid = false;
    if (typeof window !== 'undefined') window.removeEventListener('keydown', this.keyHandler);
    this.render(payload);
  }

  reset() {
    this.state = null;
    this.activeRaid = false;
    this.latestStateVersion = -1;
    this.receivedAt = 0;
    if (typeof window !== 'undefined') window.removeEventListener('keydown', this.keyHandler);
    if (this.clockTimer) clearInterval(this.clockTimer);
    this.clockTimer = null;
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }
  }

  render(resultPayload = null) {
    const state = this.state;
    const overlay = this.ensureOverlay();
    if (!overlay || !state) return;

    const boss = state.boss || {};
    const you = state.you || {};
    const now = Date.now() + (Number(state.serverNow || 0) ? Number(state.serverNow) - (this.receivedAt || Date.now()) : 0);
    const cooldownMs = Math.max(0, Number(you.actionReadyAt || 0) - now);
    const bossMs = Math.max(0, Number(state.bossActionAt || 0) - now);
    const clash = you.beamClash;
    const intent = state.bossIntent;
    const canReact = state.state === 'ACTIVE' && !clash && !you.downed && intent?.targetUids?.includes(you.uid) && !intent.respondedUids?.includes(you.uid) && now < intent.deadline;
    const incomingCard = intent ? { type: 'attack', isBeam: !!intent.profile?.isBeam, isCombo: !!intent.profile?.isPhysical, damageKind: intent.profile?.isPhysical ? 'physical' : 'beam' } : null;
    const canAct = state.state === 'ACTIVE' && !clash && !you.downed && !you.abandoned && cooldownMs <= 0;
    const hpPct = Math.max(0, Math.min(100, (boss.hp / Math.max(1, boss.maxHp)) * 100));

    const playerCards = (you.hand || []).map((card, index) => {
      const effectiveCost = getEffectiveCardCost(you, card);
      const responseType = ['defense', 'evade', 'counter'].includes(card.type) || (card.isBeam && incomingCard?.isBeam);
      const targetedWindow = intent?.targetUids?.includes(you.uid);
      const responseLegal = canReact && canUseReaction(you, incomingCard, card);
      const playable = (targetedWindow && responseType ? responseLegal : canAct) && (you.ki || 0) >= effectiveCost;
      return `
        <button class="raid-card-btn" data-index="${index}" ${playable ? '' : 'disabled'}
          style="width:150px;min-height:178px;padding:10px;text-align:left;border-radius:14px;border:2px solid ${playable ? '#ffd166' : '#3b4252'};background:#111827;color:#fff;">
          <div style="font-size:11px;font-weight:900;color:#ffd166;">${effectiveCost} KI</div>
          <div style="height:95px;position:relative;overflow:hidden;border-radius:8px;margin-top:6px;">${assetLoader.renderCardArtHTML(card)}</div>
          <div style="font-size:15px;font-weight:900;margin:8px 0;">${escapeHtml(card.name)}</div>
          <div style="font-size:11px;opacity:.72;">${escapeHtml(String(card.type || '').toUpperCase())}</div>
          ${card.power ? `<div style="margin-top:12px;font-size:22px;font-weight:900;">${card.power} ATK</div>` : ''}
          ${card.block ? `<div style="margin-top:12px;font-size:18px;font-weight:900;">${card.block} BLOCK</div>` : ''}
        </button>`;
    }).join('');

    const squad = (state.players || []).map(player => {
      const pHpPct = Math.max(0, Math.min(100, (player.hp / Math.max(1, player.maxHp)) * 100));
      const readyMs = Math.max(0, Number(player.actionReadyAt || 0) - now);
      const status = player.downed ? 'KO' : player.abandoned ? 'SAIU' : readyMs <= 0 ? 'PRONTO' : `${(readyMs / 1000).toFixed(1)}s`;
      return `
        <div style="padding:11px;border-radius:12px;border:1px solid #30394d;background:rgba(255,255,255,.03);">
          <div style="display:flex;justify-content:space-between;gap:8px;"><strong>${escapeHtml(player.username)}</strong><span style="font-size:11px;color:${readyMs <= 0 ? '#7cff9b' : '#ffd166'};">${status}</span></div>
          <div style="font-size:12px;opacity:.7;">${escapeHtml(player.leader?.name || '')}${player.isBot ? ' • CPU' : ''}</div>
          <div style="height:8px;background:#260811;border-radius:999px;overflow:hidden;margin-top:6px;"><div style="height:100%;width:${pHpPct}%;background:linear-gradient(90deg,#ff4f6d,#ffb347);"></div></div>
          <div style="font-size:12px;margin-top:4px;">HP ${player.hp}/${player.maxHp} • KI ${player.ki}/10 • Mao ${player.handSize}</div>
        </div>`;
    }).join('');

    const logs = (state.logs || []).slice(0, 8).map(log => `<div style="font-size:12px;margin:3px 0;"><span style="opacity:.5;">${escapeHtml(log.time || '')}</span> ${escapeHtml(log.text || '')}</div>`).join('');
    const finished = ['VICTORY', 'DEFEAT'].includes(state.state);

    overlay.innerHTML = `
      <div style="max-width:1220px;margin:0 auto;">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap;">
          <div><div style="font-size:11px;color:#ffd166;font-weight:900;letter-spacing:.18em;">REAL-TIME CO-OP RAID</div><h1 style="margin:3px 0;">${escapeHtml(boss.name)}</h1><div>Fase ${boss.phase || 1} • Ciclo ${state.round || 1}</div></div>
          <div style="text-align:right;"><div style="font-size:11px;opacity:.7;">PROXIMO ATAQUE DO CHEFE</div><div style="font-size:28px;font-weight:900;color:#ff8b9f;">${(bossMs / 1000).toFixed(1)}s</div></div>
        </div>

        ${intent ? `<section role="status" style="padding:14px 20px;border:1px solid #ff785b;border-radius:14px;background:linear-gradient(90deg,#391123,#171b32);margin:12px 0;"><strong>${escapeHtml(intent.profile?.name || 'ATAQUE DO CHEFE')} · ${intent.profile?.isBeam ? 'KI BEAM' : 'CORPO A CORPO'}</strong><div style="margin-top:5px;">${escapeHtml((intent.targetUids || []).map(uid => state.players.find(p => p.uid === uid)?.username || '').join(' • '))} · Resposta até ${(Math.max(0, intent.deadline - now) / 1000).toFixed(1)}s</div>${canReact ? '<div style="color:#ffe199;margin-top:6px;">Responda com defesa, esquiva, counter ou outro Ki Beam.</div>' : ''}</section>` : ''}
        ${clash ? `<section style="padding:22px;text-align:center;border:2px solid #7fd4ff;border-radius:16px;background:linear-gradient(100deg,#062331,#431524);margin:14px 0;"><strong style="font-size:22px;">DISPUTA DE KI BEAM</strong><div style="height:22px;background:#852540;border-radius:20px;overflow:hidden;margin:15px 0;"><div style="height:100%;width:${Math.max(0, Math.min(100, clash.progress))}%;background:linear-gradient(90deg,#00b5e8,#d7fbff);"></div></div><p>${(Math.max(0, clash.deadline - now) / 1000).toFixed(1)}s · Pressione ESPAÇO ou o botão para canalizar energia</p><button id="raid-beam-mash" style="padding:16px 32px;border-radius:30px;font-weight:900;background:#c2f6ff;color:#092b36;">CANALIZAR KI</button></section>` : ''}

        <div style="margin:18px 0;padding:18px;border-radius:16px;background:#16101a;border:1px solid #4b2638;">
          <div style="display:flex;justify-content:space-between;font-weight:900;"><span>${escapeHtml(boss.name)}</span><span>${boss.hp}/${boss.maxHp} HP</span></div>
          <div style="height:24px;background:#260811;border-radius:99px;overflow:hidden;margin-top:10px;"><div style="height:100%;width:${hpPct}%;background:linear-gradient(90deg,#ff3d6e,#ffba49);"></div></div>
        </div>

        ${finished ? `<div style="text-align:center;padding:30px;border:2px solid ${state.state === 'VICTORY' ? '#ffd166' : '#ff5d73'};border-radius:18px;background:rgba(0,0,0,.4);margin-bottom:18px;"><div style="font-size:50px;font-weight:1000;">${state.state === 'VICTORY' ? 'VITORIA' : 'DERROTA'}</div>${resultPayload?.reward ? `<div style="margin-top:10px;">+${resultPayload.reward.zeni || 0} Zeni • +${resultPayload.reward.xp || 0} XP • +${resultPayload.reward.trophies || 0} Trofeu(s)</div>` : ''}<button id="raid-result-close" style="margin-top:18px;padding:11px 20px;font-weight:900;">VOLTAR AO MENU</button></div>` : ''}

        <section style="margin-bottom:16px;"><div style="font-size:11px;color:#7cc9ff;font-weight:900;margin-bottom:8px;">ESQUADRA — TODOS AGEM AO MESMO TEMPO</div><div style="display:grid;grid-template-columns:repeat(4,minmax(190px,1fr));gap:8px;">${squad}</div></section>

        <div style="display:grid;grid-template-columns:1fr 330px;gap:16px;">
          <section style="padding:14px;border-radius:16px;background:rgba(255,255,255,.04);">
            <div style="display:flex;justify-content:space-between;gap:10px;"><div><strong>${escapeHtml(you.username || 'Voce')}</strong><div>HP ${you.hp || 0}/${you.maxHp || 0} • KI ${you.ki || 0}/10</div></div><div style="font-weight:900;color:${canAct ? '#7cff9b' : '#ffd166'};">${canAct ? 'PRONTO PARA AGIR' : `RECARGA ${(cooldownMs / 1000).toFixed(1)}s`}</div></div>
            <div style="display:flex;gap:8px;margin:12px 0;flex-wrap:wrap;"><button id="raid-charge-btn" ${canAct ? '' : 'disabled'} style="padding:11px 16px;font-weight:900;">CARREGAR KI</button><button id="raid-pass-btn" ${canAct ? '' : 'disabled'} style="padding:11px 16px;font-weight:900;">REPOSICIONAR</button><button id="raid-leave-btn" style="padding:11px 16px;font-weight:900;">SAIR</button></div>
            <div style="display:flex;gap:10px;flex-wrap:wrap;">${playerCards}</div>
          </section>
          <aside style="padding:12px;border-radius:16px;background:rgba(0,0,0,.3);"><strong>LOG</strong><div style="margin-top:8px;">${logs}</div></aside>
        </div>
      </div>`;

    overlay.querySelectorAll('.raid-card-btn').forEach(button => button.addEventListener('click', () => {
      const index = Number(button.dataset.index);
      const card = you.hand?.[index];
      this.actionHandler?.('playCard', { cardIndex: index, cardId: card?.id || null });
    }));
    overlay.querySelector('#raid-charge-btn')?.addEventListener('click', () => this.actionHandler?.('chargeKi', {}));
    overlay.querySelector('#raid-pass-btn')?.addEventListener('click', () => this.actionHandler?.('passTurn', {}));
    overlay.querySelector('#raid-beam-mash')?.addEventListener('click', () => this.actionHandler?.('mashBeamClash', {}));
    const leave = () => { this.cancelHandler?.(); this.reset(); };
    overlay.querySelector('#raid-leave-btn')?.addEventListener('click', leave);
    overlay.querySelector('#raid-result-close')?.addEventListener('click', leave);
  }
}

export const raidEngine = new RaidEngine();
