import { getEffectiveCardCost, isAttackAction } from './content-rules.js';
import { escapeHtml } from './safe-dom.js';

export class TeamBattleUI {
  constructor() {
    this.state = null;
    this.localUid = null;
    this.onAction = null;
    this.root = null;
    this.selectedTargetUid = null;
    this.clockTimer = null;
  }

  bind({ onAction } = {}) {
    this.onAction = typeof onAction === 'function' ? onAction : null;
  }

  applyState(state, localUid) {
    this.state = state;
    this.localUid = localUid || this.localUid;
    const enemySide = state?.teamSide === 'A' ? 'B' : 'A';
    const enemies = state?.teams?.[enemySide] || [];
    if (!enemies.some(member => member.uid === this.selectedTargetUid && !member.downed && !member.abandoned)) {
      this.selectedTargetUid = enemies.find(member => !member.downed && !member.abandoned)?.uid || null;
    }
    this.render();
    this._ensureClock();
  }

  reset() {
    this.state = null;
    this.localUid = null;
    this.selectedTargetUid = null;
    if (this.clockTimer) clearInterval(this.clockTimer);
    this.clockTimer = null;
    if (this.root) {
      this.root.remove();
      this.root = null;
    }
  }

  _ensureClock() {
    if (this.clockTimer) return;
    this.clockTimer = setInterval(() => {
      if (!this.state || this.state.finished) return;
      this.render();
    }, 500);
  }

  ensureRoot() {
    if (typeof document === 'undefined') return null;
    if (this.root?.isConnected) return this.root;
    const root = document.createElement('div');
    root.id = 'squad-battle-hud';
    root.style.cssText = [
      'position:fixed', 'inset:0', 'z-index:24000',
      'background:radial-gradient(circle at center,#17223d 0%,#080b13 56%,#02040a 100%)',
      'color:#fff', 'overflow:auto', 'padding:18px', 'font-family:Inter,Arial,sans-serif'
    ].join(';');
    document.body.appendChild(root);
    this.root = root;
    return root;
  }

  _memberCard(member, enemy = false) {
    const readyMs = Math.max(0, Number(member.actionReadyAt || 0) - Date.now());
    const readyText = member.downed ? 'KO' : member.abandoned ? 'SAIU' : readyMs <= 0 ? 'PRONTO' : `${(readyMs / 1000).toFixed(1)}s`;
    const selected = enemy && member.uid === this.selectedTargetUid;
    const hpPct = Math.max(0, Math.min(100, (member.hp / Math.max(1, member.maxHp)) * 100));
    return `
      <button class="squad-fighter ${enemy ? 'enemy' : 'ally'}" data-uid="${escapeHtml(member.uid)}" ${enemy && !member.downed && !member.abandoned ? '' : 'disabled'}
        style="text-align:left;padding:12px;border-radius:14px;border:2px solid ${selected ? '#ffdf6e' : enemy ? '#7f3044' : '#2d6f9f'};
        background:${selected ? 'rgba(255,223,110,.12)' : 'rgba(6,10,20,.88)'};color:#fff;min-width:220px;">
        <div style="display:flex;justify-content:space-between;gap:12px;align-items:center;">
          <strong>${escapeHtml(member.username)}</strong><span style="font-size:11px;color:${readyMs <= 0 ? '#7CFF9B' : '#ffd166'};">${readyText}</span>
        </div>
        <div style="font-size:12px;opacity:.72;margin-top:2px;">${escapeHtml(member.leader?.name || '')}${member.isBot ? ' • CPU' : ''}</div>
        <div style="height:9px;background:#260811;border-radius:999px;overflow:hidden;margin-top:8px;">
          <div style="height:100%;width:${hpPct}%;background:linear-gradient(90deg,#ff4f6d,#ffb347);"></div>
        </div>
        <div style="font-size:12px;margin-top:5px;">HP ${member.hp}/${member.maxHp} • KI ${member.ki}/10 • Mao ${member.handSize}</div>
        ${selected ? '<div style="margin-top:5px;color:#ffdf6e;font-size:11px;font-weight:900;">ALVO SELECIONADO</div>' : ''}
      </button>`;
  }

  render() {
    const state = this.state;
    const root = this.ensureRoot();
    if (!root || !state) return;

    const localSide = state.teamSide;
    const enemySide = localSide === 'A' ? 'B' : 'A';
    const allies = state.teams?.[localSide] || [];
    const enemies = state.teams?.[enemySide] || [];
    const you = state.you || {};
    const cooldownMs = Math.max(0, Number(you.actionReadyAt || 0) - Date.now());
    const canAct = state.state === 'ACTIVE' && !state.finished && !you.downed && !you.abandoned && cooldownMs <= 0;

    const cards = (you.hand || []).map((card, index) => {
      const cost = getEffectiveCardCost(you, card);
      const needsTarget = isAttackAction(card);
      const playable = canAct && you.ki >= cost && (!needsTarget || !!this.selectedTargetUid);
      return `
        <button class="squad-card" data-index="${index}" ${playable ? '' : 'disabled'}
          style="width:145px;min-height:170px;padding:10px;border-radius:14px;text-align:left;border:2px solid ${playable ? '#ffd166' : '#374151'};background:#111827;color:#fff;">
          <div style="font-size:11px;color:#ffd166;font-weight:900;">${cost} KI</div>
          <div style="font-weight:900;margin:8px 0;">${escapeHtml(card.name)}</div>
          <div style="font-size:11px;opacity:.65;">${escapeHtml(String(card.type || '').toUpperCase())}</div>
          ${card.power ? `<div style="font-size:22px;font-weight:900;margin-top:12px;">${card.power} ATK</div>` : ''}
          ${card.block ? `<div style="font-size:18px;font-weight:900;margin-top:12px;">${card.block} BLOCK</div>` : ''}
        </button>`;
    }).join('');

    const logs = (state.logs || []).slice(0, 7).map(log => `<div style="font-size:12px;margin:3px 0;"><span style="opacity:.45;">${escapeHtml(log.time || '')}</span> ${escapeHtml(log.text || '')}</div>`).join('');

    root.innerHTML = `
      <div style="max-width:1280px;margin:0 auto;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
          <div><div style="font-size:11px;color:#ffd166;font-weight:900;letter-spacing:.18em;">REAL-TIME SQUAD BATTLE</div><h2 style="margin:3px 0;">TIME ${localSide} vs TIME ${enemySide}</h2></div>
          <div style="font-weight:900;color:${state.finished ? '#ffd166' : '#7cff9b'};">${state.finished ? `VENCEDOR: TIME ${state.teamWinner}` : '4 LUTADORES EM CAMPO'}</div>
        </div>

        <section style="padding:12px;border-radius:16px;background:rgba(100,15,35,.16);border:1px solid #6b2339;">
          <div style="font-size:11px;font-weight:900;color:#ff8da1;margin-bottom:8px;">TIME INIMIGO — CLIQUE PARA ESCOLHER O ALVO</div>
          <div style="display:grid;grid-template-columns:repeat(2,minmax(220px,1fr));gap:10px;">${enemies.map(member => this._memberCard(member, true)).join('')}</div>
        </section>

        <div style="display:grid;grid-template-columns:1fr 320px;gap:16px;margin:16px 0;">
          <section style="padding:14px;border-radius:16px;background:rgba(255,255,255,.04);">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;">
              <div><strong>${escapeHtml(you.username || 'Voce')}</strong><div style="font-size:12px;opacity:.7;">${escapeHtml(you.leader?.name || '')}</div></div>
              <div style="font-weight:900;color:${canAct ? '#7cff9b' : '#ffd166'};">${canAct ? 'PRONTO PARA AGIR' : `RECARGA ${(cooldownMs / 1000).toFixed(1)}s`}</div>
            </div>
            <div style="display:flex;gap:8px;margin:12px 0;flex-wrap:wrap;">
              <button id="squad-charge" ${canAct ? '' : 'disabled'} style="padding:10px 15px;font-weight:900;">CARREGAR KI</button>
              <button id="squad-pass" ${canAct ? '' : 'disabled'} style="padding:10px 15px;font-weight:900;">REPOSICIONAR</button>
              <div style="padding:10px 15px;">HP ${you.hp}/${you.maxHp} • KI ${you.ki}/10</div>
            </div>
            <div style="display:flex;gap:10px;flex-wrap:wrap;">${cards}</div>
          </section>
          <aside style="padding:12px;border-radius:16px;background:rgba(0,0,0,.28);"><strong>COMBATE</strong><div style="margin-top:8px;">${logs}</div></aside>
        </div>

        <section style="padding:12px;border-radius:16px;background:rgba(15,70,100,.15);border:1px solid #24597a;">
          <div style="font-size:11px;font-weight:900;color:#7cc9ff;margin-bottom:8px;">SEU TIME — A E B LUTAM JUNTOS</div>
          <div style="display:grid;grid-template-columns:repeat(2,minmax(220px,1fr));gap:10px;">${allies.map(member => this._memberCard(member, false)).join('')}</div>
        </section>
      </div>`;

    root.querySelectorAll('.squad-fighter.enemy').forEach(button => {
      button.addEventListener('click', () => {
        this.selectedTargetUid = button.dataset.uid;
        this.render();
      });
    });

    root.querySelectorAll('.squad-card').forEach(button => {
      button.addEventListener('click', () => {
        const index = Number(button.dataset.index);
        const card = you.hand?.[index];
        if (!card || !this.onAction) return;
        this.onAction('playCard', {
          cardIndex: index,
          cardId: card.id,
          targetUid: isAttackAction(card) ? this.selectedTargetUid : null
        });
      });
    });

    root.querySelector('#squad-charge')?.addEventListener('click', () => this.onAction?.('chargeKi', {}));
    root.querySelector('#squad-pass')?.addEventListener('click', () => this.onAction?.('passTurn', {}));
  }
}

export const teamBattleUI = new TeamBattleUI();
