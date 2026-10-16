/* ==========================================================================
   Dragon Ball Clash Action TCG - Raid Client State + HUD
   ========================================================================== */

import { getEffectiveCardCost } from './content-rules.js';
import { RAID_BOSSES, RAID_MIN_PLAYERS, RAID_MAX_PLAYERS } from './raid-rules.js';
import { escapeHtml } from './safe-dom.js';

export class RaidEngine {
  constructor() {
    this.state = null;
    this.activeRaid = false;
    this.actionHandler = null;
    this.cancelHandler = null;
    this.overlay = null;
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
        'position:fixed',
        'inset:0',
        'z-index:25000',
        'background:radial-gradient(circle at top,#25120b 0%,#090b13 52%,#03050a 100%)',
        'color:#fff',
        'overflow:auto',
        'padding:24px',
        'font-family:Inter,Arial,sans-serif'
      ].join(';');
      document.body.appendChild(overlay);
    }

    this.overlay = overlay;
    return overlay;
  }

  showQueue(bossId = 'cell_max', count = 1) {
    this.activeRaid = false;
    const boss = RAID_BOSSES[bossId] || RAID_BOSSES.cell_max;
    const overlay = this.ensureOverlay();
    if (!overlay) return;

    overlay.innerHTML = `
      <div style="max-width:760px;margin:10vh auto;text-align:center;">
        <div style="font-size:12px;font-weight:900;color:#ffd166;letter-spacing:.2em;">RAID MATCHMAKING</div>
        <h1 style="font-size:42px;margin:10px 0;">${escapeHtml(boss.name)}</h1>
        <p>Formando esquadra cooperativa de ${RAID_MIN_PLAYERS}-${RAID_MAX_PLAYERS} jogadores.</p>
        <div style="font-size:64px;font-weight:900;margin:34px 0;">${count}/${RAID_MAX_PLAYERS}</div>
        <p style="opacity:.75;">Com 3 jogadores, a partida inicia apos uma curta janela para o quarto entrar.</p>
        <button id="raid-cancel-queue" style="padding:12px 22px;font-weight:900;">CANCELAR BUSCA</button>
      </div>`;

    overlay.querySelector('#raid-cancel-queue')?.addEventListener('click', () => {
      if (this.cancelHandler) this.cancelHandler();
      this.reset();
    });
  }

  applyServerState(state) {
    if (!state) return;
    this.state = state;
    this.activeRaid = ['ACTIVE', 'BOSS_TURN'].includes(state.state);
    this.render();
  }

  showResult(payload) {
    if (payload?.state) this.state = payload.state;
    this.activeRaid = false;
    this.render(payload);
  }

  reset() {
    this.state = null;
    this.activeRaid = false;
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
    const you = state.you;
    const isYourTurn = state.state === 'ACTIVE' && state.currentPlayerUid === you?.uid && !you?.downed;
    const hpPct = Math.max(0, Math.min(100, (boss.hp / Math.max(1, boss.maxHp)) * 100));
    const turnSeconds = state.turnDeadline
      ? Math.max(0, Math.ceil((state.turnDeadline - Date.now()) / 1000))
      : 0;

    const playerCards = (you?.hand || []).map((card, index) => {
      const effectiveCost = getEffectiveCardCost(you, card);
      const affordable = (you?.ki || 0) >= effectiveCost;
      const playable = isYourTurn && affordable;
      return `
        <button class="raid-card-btn" data-index="${index}" ${playable ? '' : 'disabled'}
          style="width:150px;min-height:178px;padding:10px;text-align:left;border-radius:14px;
          border:2px solid ${playable ? '#ffd166' : '#3b4252'};background:#111827;color:#fff;">
          <div style="font-size:11px;font-weight:900;color:#ffd166;">${effectiveCost} KI</div>
          <div style="font-size:15px;font-weight:900;margin:8px 0;">${card.name}</div>
          <div style="font-size:11px;opacity:.72;">${card.type.toUpperCase()}</div>
          ${card.power ? `<div style="margin-top:12px;font-size:22px;font-weight:900;">${card.power} ATK</div>` : ''}
          ${card.block ? `<div style="margin-top:12px;font-size:18px;font-weight:900;">${card.block} BLOCK</div>` : ''}
        </button>`;
    }).join('');

    const squad = (state.players || []).map(player => {
      const active = player.uid === state.currentPlayerUid;
      return `
        <div style="padding:12px;border-radius:12px;border:1px solid ${active ? '#ffd166' : '#30394d'};
          background:${active ? 'rgba(255,209,102,.10)' : 'rgba(255,255,255,.03)'};">
          <div style="font-weight:900;">${escapeHtml(player.username)}</div>
          <div style="font-size:12px;opacity:.75;">${player.leader?.name || ''}</div>
          <div style="margin-top:6px;">HP ${player.hp}/${player.maxHp} | KI ${player.ki}/10 | Mao ${player.handSize}</div>
          ${player.downed ? '<div style="color:#ff6b6b;font-weight:900;">DERRUBADO</div>' : ''}
          ${player.abandoned ? '<div style="color:#ff6b6b;font-weight:900;">ABANDONOU</div>' : ''}
        </div>`;
    }).join('');

    const logs = (state.logs || []).slice(0, 8).map(log =>
      `<div style="font-size:12px;margin:3px 0;"><span style="opacity:.5;">${escapeHtml(log.time || '')}</span> ${escapeHtml(log.text)}</div>`
    ).join('');

    const finished = ['VICTORY', 'DEFEAT'].includes(state.state);

    overlay.innerHTML = `
      <div style="max-width:1180px;margin:0 auto;">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap;">
          <div>
            <div style="font-size:11px;color:#ffd166;font-weight:900;letter-spacing:.18em;">CO-OP RAID</div>
            <h1 style="margin:3px 0;">${escapeHtml(boss.name)}</h1>
            <div>Fase ${boss.phase || 1} | Round ${state.round || 1}</div>
          </div>
          <button id="raid-leave-btn" style="padding:10px 16px;font-weight:900;">SAIR DO RAID</button>
        </div>

        <div style="margin:20px 0;padding:18px;border-radius:16px;background:#16101a;border:1px solid #4b2638;">
          <div style="display:flex;justify-content:space-between;font-weight:900;">
            <span>${escapeHtml(boss.name)}</span><span>${boss.hp}/${boss.maxHp} HP</span>
          </div>
          <div style="height:24px;background:#260811;border-radius:99px;overflow:hidden;margin-top:10px;">
            <div style="height:100%;width:${hpPct}%;background:linear-gradient(90deg,#ff3d6e,#ffba49);"></div>
          </div>
        </div>

        ${finished ? `
          <div style="text-align:center;padding:34px;border:2px solid ${state.state === 'VICTORY' ? '#ffd166' : '#ff5d73'};
            border-radius:18px;background:rgba(0,0,0,.4);margin-bottom:20px;">
            <div style="font-size:54px;font-weight:1000;">${state.state === 'VICTORY' ? 'VITORIA' : 'DERROTA'}</div>
            ${resultPayload?.reward ? `
              <div style="font-size:18px;margin-top:12px;">
                +${resultPayload.reward.zeni || 0} Zeni |
                +${resultPayload.reward.xp || 0} XP |
                +${resultPayload.reward.trophies || 0} Trofeu(s) |
                +${resultPayload.reward.gems || 0} Gem(s)
              </div>` : ''}
            <button id="raid-result-close" style="margin-top:22px;padding:12px 22px;font-weight:900;">VOLTAR AO MENU</button>
          </div>` : ''}

        <div style="display:grid;grid-template-columns:1.2fr .8fr;gap:18px;">
          <div>
            <div style="padding:14px;border-radius:14px;background:rgba(255,255,255,.04);margin-bottom:14px;">
              <div style="font-weight:900;font-size:18px;">${escapeHtml(you?.username || 'Voce')}</div>
              <div>HP ${you?.hp || 0}/${you?.maxHp || 0} | KI ${you?.ki || 0}/10</div>
              <div style="font-size:12px;opacity:.75;margin-top:4px;">
                ${you?.guardBlock ? `Guard ${you.guardBlock} | ` : ''}
                ${you?.dodgeNext ? 'Dodge preparado | ' : ''}
                ${you?.counterNext ? `Counter ${you.counterNext} | ` : ''}
                ${you?.nextAttackBonus ? `Proximo ataque +${you.nextAttackBonus}` : ''}
              </div>
            </div>

            <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px;">
              <button id="raid-charge-btn" ${isYourTurn ? '' : 'disabled'} style="padding:11px 16px;font-weight:900;">CARREGAR KI</button>
              <button id="raid-pass-btn" ${isYourTurn ? '' : 'disabled'} style="padding:11px 16px;font-weight:900;">PASSAR</button>
              <div style="padding:11px 16px;font-weight:900;color:#ffd166;">
                ${isYourTurn ? `SEU TURNO - ${turnSeconds}s` : 'AGUARDANDO COMPANHEIRO'}
              </div>
            </div>

            <div style="display:flex;gap:10px;flex-wrap:wrap;">${playerCards}</div>
          </div>

          <div>
            <h3>ESQUADRA</h3>
            <div style="display:grid;gap:8px;">${squad}</div>
            <h3 style="margin-top:18px;">LOG</h3>
            <div style="padding:10px;border-radius:12px;background:rgba(0,0,0,.3);">${logs}</div>
          </div>
        </div>
      </div>`;

    overlay.querySelectorAll('.raid-card-btn').forEach(button => {
      button.addEventListener('click', () => {
        if (this.actionHandler) {
          const index = Number(button.dataset.index);
          const card = you?.hand?.[index];
          this.actionHandler('playCard', {
            cardIndex: index,
            cardId: card?.id || null
          });
        }
      });
    });

    overlay.querySelector('#raid-charge-btn')?.addEventListener('click', () => {
      if (this.actionHandler) this.actionHandler('chargeKi', {});
    });

    overlay.querySelector('#raid-pass-btn')?.addEventListener('click', () => {
      if (this.actionHandler) this.actionHandler('passTurn', {});
    });

    const leave = () => {
      if (this.cancelHandler) this.cancelHandler();
      this.reset();
    };

    overlay.querySelector('#raid-leave-btn')?.addEventListener('click', leave);
    overlay.querySelector('#raid-result-close')?.addEventListener('click', leave);
  }
}

export const raidEngine = new RaidEngine();
