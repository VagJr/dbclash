export class TeamBattleUI {
  constructor() {
    this.state = null;
    this.localUid = null;
    this.onTag = null;
    this.root = null;
  }

  bind({ onTag } = {}) {
    this.onTag = typeof onTag === 'function' ? onTag : null;
  }

  applyState(state, localUid) {
    this.state = state;
    this.localUid = localUid || this.localUid;
    this.render();
  }

  reset() {
    this.state = null;
    this.localUid = null;
    if (this.root) {
      this.root.remove();
      this.root = null;
    }
  }

  ensureRoot() {
    if (typeof document === 'undefined') return null;
    if (this.root?.isConnected) return this.root;

    const arena = document.getElementById('scene-arena') || document.body;
    const root = document.createElement('div');
    root.id = 'tag-team-hud';
    root.style.cssText = [
      'position:absolute',
      'left:12px',
      'right:12px',
      'top:72px',
      'z-index:1200',
      'display:flex',
      'justify-content:space-between',
      'pointer-events:none',
      'gap:12px'
    ].join(';');
    arena.appendChild(root);
    this.root = root;
    return root;
  }

  renderMember(member) {
    const status = member.abandoned ? 'SAIU' : member.downed ? 'KO' : member.active ? 'ATIVO' : 'RESERVA';
    return `
      <div style="padding:7px 10px;border-radius:9px;background:rgba(5,8,16,.88);border:1px solid ${member.active ? '#ffd166' : '#374151'};min-width:160px;">
        <div style="font-size:11px;font-weight:900;color:${member.active ? '#ffd166' : '#fff'};">${status}</div>
        <div style="font-size:12px;font-weight:900;">${member.username}</div>
        <div style="font-size:11px;opacity:.8;">HP ${member.hp}/${member.maxHp} | KI ${member.ki}/10</div>
      </div>`;
  }

  render() {
    const state = this.state;
    const root = this.ensureRoot();
    if (!root || !state) return;

    const localSide = state.teamSide;
    const yourTeam = state.teams?.[localSide] || [];
    const enemySide = localSide === 'A' ? 'B' : 'A';
    const enemyTeam = state.teams?.[enemySide] || [];
    const me = yourTeam.find(member => member.uid === this.localUid);
    const reserve = yourTeam.find(member => member.uid !== this.localUid && !member.downed && !member.abandoned);
    const duel = state.duel || {};
    const myInitiativeKey = localSide === 'A' ? 'player' : 'opponent';
    const canTag = !!(
      me?.active &&
      reserve &&
      duel.state === 'FREE_ACTION' &&
      duel.initiative === myInitiativeKey &&
      !state.finished
    );

    root.innerHTML = `
      <div style="display:grid;gap:6px;pointer-events:auto;">${yourTeam.map(m => this.renderMember(m)).join('')}
        ${canTag ? '<button id="tag-team-switch-btn" style="padding:7px 10px;font-weight:900;border-radius:8px;border:1px solid #ffd166;background:#1f2937;color:#ffd166;">TROCAR LUTADOR</button>' : ''}
      </div>
      <div style="display:grid;gap:6px;pointer-events:auto;">${enemyTeam.map(m => this.renderMember(m)).join('')}</div>`;

    root.querySelector('#tag-team-switch-btn')?.addEventListener('click', () => {
      if (this.onTag) this.onTag();
    });
  }
}

export const teamBattleUI = new TeamBattleUI();
