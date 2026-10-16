import { getEffectiveCardCost, isAttackAction } from './content-rules.js';
import { assetLoader } from './asset-loader.js';
import { soundEngine } from './audio.js';
import { escapeHtml } from './safe-dom.js';

export class TeamBattleUI {
  constructor() {
    this.state = null;
    this.localUid = null;
    this.onAction = null;
    this.selectedTargetUid = null;
    this.draggedCardIndex = null;
    this.auxEnemyHud = null;
    this.auxAllyHud = null;
    this.clockTimer = null;
    this.officialHandlersBound = false;
  }

  bind({ onAction } = {}) {
    this.onAction = typeof onAction === 'function' ? onAction : null;
    this._bindOfficialArenaControls();
  }

  applyState(state, localUid) {
    if (!state) return;

    this.state = state;
    this.localUid = localUid || this.localUid;

    const enemySide = state.teamSide === 'A' ? 'B' : 'A';
    const enemies = state.teams?.[enemySide] || [];
    const selectedStillAlive = enemies.some(member =>
      member.uid === this.selectedTargetUid &&
      !member.downed &&
      !member.abandoned &&
      member.hp > 0
    );

    if (!selectedStillAlive) {
      this.selectedTargetUid =
        enemies.find(member => !member.downed && !member.abandoned && member.hp > 0)?.uid ||
        enemies[0]?.uid ||
        null;
    }

    this._enterOfficialArenaMode();
    this.render();
    this._ensureClock();
  }

  reset() {
    this.state = null;
    this.localUid = null;
    this.selectedTargetUid = null;
    this.draggedCardIndex = null;

    if (this.clockTimer) clearInterval(this.clockTimer);
    this.clockTimer = null;

    document.getElementById('scene-arena')?.classList.remove('squad-realtime-mode');

    this.auxEnemyHud?.remove();
    this.auxAllyHud?.remove();
    this.auxEnemyHud = null;
    this.auxAllyHud = null;

    const phase = document.getElementById('turn-phase-bar');
    phase?.classList.remove('squad-phase');

    const indicator = document.getElementById('squad-target-indicator');
    indicator?.remove();

    const koModal = document.getElementById('ko-modal');
    koModal?.classList.remove('active');

    document.getElementById('p2-leader-box')?.classList.remove('squad-target-selected');
  }

  _ensureClock() {
    if (this.clockTimer) return;
    this.clockTimer = setInterval(() => {
      if (!this.state || this.state.finished) return;
      this._renderCooldownOnly();
    }, 200);
  }

  _enterOfficialArenaMode() {
    const arena = document.getElementById('scene-arena');
    if (!arena) return;

    arena.classList.add('squad-realtime-mode');
    this._ensureAuxHuds();
    this._bindOfficialArenaControls();
  }

  _ensureAuxHuds() {
    const top = document.querySelector('#scene-arena .arena-zone-top');
    const bottom = document.querySelector('#scene-arena .arena-zone-bot');
    if (!top || !bottom) return;

    if (!this.auxEnemyHud?.isConnected) {
      this.auxEnemyHud = this._createAuxHud('squad-enemy-secondary-hud', 'enemy');
      top.appendChild(this.auxEnemyHud);
    }

    if (!this.auxAllyHud?.isConnected) {
      this.auxAllyHud = this._createAuxHud('squad-ally-secondary-hud', 'ally');
      const actions = bottom.querySelector('.action-row');
      if (actions) bottom.insertBefore(this.auxAllyHud, actions);
      else bottom.appendChild(this.auxAllyHud);
    }
  }

  _createAuxHud(id, role) {
    const hud = document.createElement('button');
    hud.id = id;
    hud.type = 'button';
    hud.className = `fighter-hud dokkan-scouter-hud squad-secondary-hud ${role === 'enemy' ? 'hud-opponent' : 'hud-player'}`;
    hud.dataset.squadRole = role;
    hud.innerHTML = `
      <div class="scouter-scanlines"></div>
      <div class="scouter-portrait-wrapper">
        <div class="hud-portrait squad-portrait"></div>
        <div class="scouter-lockon-ring"></div>
      </div>
      <div class="hud-info">
        <div class="hud-top-row">
          <div class="hud-name squad-name"></div>
          <span class="hp-text squad-hp-text"></span>
        </div>
        <div class="hp-bar-container">
          <div class="hp-bar-track"><div class="hp-bar-fill squad-hp-fill"></div></div>
        </div>
        <div class="hud-bottom-row">
          <div class="shields-row squad-status-row"></div>
          <div class="ki-row">
            <div class="ki-pips squad-ki-pips"></div>
            <span class="ki-label squad-ki-text"></span>
          </div>
        </div>
      </div>
      <div class="guard-warn">TARGET</div>
      <div class="scouter-ear-cap"><div class="sec-slot"></div></div>
    `;

    if (role === 'enemy') {
      hud.addEventListener('click', () => {
        const uid = hud.dataset.squadUid;
        if (uid) this.selectTarget(uid);
      });
    } else {
      hud.disabled = true;
    }

    return hud;
  }

  _bindOfficialArenaControls() {
    if (this.officialHandlersBound || typeof document === 'undefined') return;
    this.officialHandlersBound = true;

    const intercept = (id, action) => {
      document.addEventListener('click', event => {
        if (!this.state || this.state.mode !== '2v2-realtime') return;
        const button = event.target?.closest?.(`#${id}`);
        if (!button) return;

        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();

        if (button.disabled) return;
        soundEngine.playClick?.();
        this.onAction?.(action, {});
      }, true);
    };

    intercept('charge-ki-btn', 'chargeKi');
    intercept('pass-turn-btn', 'passTurn');

    document.addEventListener('click', event => {
      if (!this.state || this.state.mode !== '2v2-realtime') return;
      const mainEnemy = event.target?.closest?.('#p2-leader-box');
      if (!mainEnemy) return;

      event.preventDefault();
      event.stopPropagation();
      const uid = mainEnemy.dataset.squadUid;
      if (uid) this.selectTarget(uid);
    }, true);

    document.addEventListener('dragover', event => {
      if (!this.state || this.state.mode !== '2v2-realtime') return;
      if (!event.target?.closest?.('#drop-zone')) return;
      event.preventDefault();
      document.getElementById('drop-zone')?.classList.add('drag-over');
    }, true);

    document.addEventListener('drop', event => {
      if (!this.state || this.state.mode !== '2v2-realtime') return;
      if (!event.target?.closest?.('#drop-zone')) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      document.getElementById('drop-zone')?.classList.remove('drag-over');

      if (this.draggedCardIndex === null) return;
      const you = this.state.you || {};
      const card = you.hand?.[this.draggedCardIndex];
      if (!card) return;

      this._playCard(this.draggedCardIndex, card);
      this.draggedCardIndex = null;
    }, true);
  }

  selectTarget(uid) {
    const state = this.state;
    if (!state || !uid) return;

    const enemySide = state.teamSide === 'A' ? 'B' : 'A';
    const valid = (state.teams?.[enemySide] || []).some(member =>
      member.uid === uid &&
      !member.downed &&
      !member.abandoned &&
      member.hp > 0
    );

    if (!valid) return;

    this.selectedTargetUid = uid;
    soundEngine.playClick?.();
    this.render();
  }

  _leaderName(member) {
    if (!member?.leader) return '';
    return member.isAwakened
      ? member.leader.awakenedName || member.leader.name || ''
      : member.leader.name || '';
  }

  _renderMainHud(prefix, member, { selected = false } = {}) {
    if (!member) return;

    const portrait = document.getElementById(`${prefix}-portrait`);
    const name = document.getElementById(`${prefix}-name`);
    const hpFill = document.getElementById(`${prefix}-hp-fill`);
    const hpText = document.getElementById(`${prefix}-hp-text`);
    const shields = document.getElementById(`${prefix}-shields`);
    const kiSlots = document.getElementById(`${prefix}-ki-slots`);
    const kiText = document.getElementById(`${prefix}-ki-text`);
    const leaderBox = document.getElementById(`${prefix}-leader-box`);

    if (leaderBox) {
      leaderBox.dataset.squadUid = member.uid || '';
      leaderBox.classList.toggle('squad-target-selected', selected);
      leaderBox.classList.toggle('squad-ko', !!member.downed);
      leaderBox.classList.toggle('squad-cpu', !!member.isBot);
      leaderBox.setAttribute('aria-label', `${this._leaderName(member)} ${member.username || ''}`);
    }

    if (portrait) {
      portrait.innerHTML = assetLoader.renderLeaderPortraitHTML(member.leader, member.isAwakened);
      portrait.classList.toggle('awakened', !!member.isAwakened);
    }

    if (name) {
      const cpu = member.isBot ? ' <span class="squad-cpu-badge">CPU</span>' : '';
      const awakened = member.isAwakened ? ' <span class="awaken-badge" style="display:inline-block">AWAKENED</span>' : '';
      name.innerHTML = `${escapeHtml(this._leaderName(member))}${cpu}${awakened}`;
    }

    this._renderHp(hpFill, hpText, member);
    this._renderKi(kiSlots, kiText, member.ki);

    if (shields) {
      const ready = this._memberReadyText(member);
      shields.innerHTML = `<span class="squad-state-pill ${member.downed ? 'ko' : ''}">${escapeHtml(ready)}</span>`;
    }
  }

  _renderAuxHud(hud, member, { selected = false } = {}) {
    if (!hud || !member) {
      if (hud) hud.style.display = 'none';
      return;
    }

    hud.style.display = '';
    hud.dataset.squadUid = member.uid || '';
    hud.classList.toggle('squad-target-selected', selected);
    hud.classList.toggle('squad-ko', !!member.downed);
    hud.classList.toggle('squad-cpu', !!member.isBot);

    const portrait = hud.querySelector('.squad-portrait');
    if (portrait) {
      portrait.innerHTML = assetLoader.renderLeaderPortraitHTML(member.leader, member.isAwakened);
      portrait.classList.toggle('awakened', !!member.isAwakened);
    }

    const name = hud.querySelector('.squad-name');
    if (name) {
      // The explicit escaping here is intentional because this HUD uses HTML.
      const safeUsername = escapeHtml(member.username);
      const safeUid = escapeHtml(member.uid);
      const safeLeader = escapeHtml(member.leader?.name || '');
      name.innerHTML =
        `<span class="squad-player-label" data-uid="${safeUid}">${safeLeader}</span>` +
        `<span class="squad-user-label">${safeUsername}</span>` +
        (member.isBot ? '<span class="squad-cpu-badge">CPU</span>' : '');
    }

    this._renderHp(
      hud.querySelector('.squad-hp-fill'),
      hud.querySelector('.squad-hp-text'),
      member
    );

    this._renderKi(
      hud.querySelector('.squad-ki-pips'),
      hud.querySelector('.squad-ki-text'),
      member.ki
    );

    const status = hud.querySelector('.squad-status-row');
    if (status) {
      status.innerHTML = `<span class="squad-state-pill ${member.downed ? 'ko' : ''}">${escapeHtml(this._memberReadyText(member))}</span>`;
    }

    hud.disabled = hud.dataset.squadRole !== 'enemy' || member.downed || member.abandoned;
  }

  _renderHp(fill, text, member) {
    if (fill) {
      const pct = Math.max(0, Math.min(100, (member.hp / Math.max(1, member.maxHp)) * 100));
      fill.style.width = `${pct}%`;
      fill.className = 'hp-bar-fill' + (pct <= 25 ? ' hp-low' : pct <= 50 ? ' hp-mid' : '');
    }
    if (text) text.textContent = `${member.hp}/${member.maxHp} HP`;
  }

  _renderKi(container, text, value = 0) {
    if (container) {
      container.replaceChildren();
      for (let i = 0; i < 10; i++) {
        const pip = document.createElement('div');
        pip.className = `ki-pip${i < value ? ' filled' : ''}`;
        container.appendChild(pip);
      }
    }
    if (text) text.textContent = `${value}/10 KI`;
  }

  _memberReadyText(member) {
    if (member.abandoned) return 'SAIU';
    if (member.downed || member.hp <= 0) return 'K.O.';
    const remaining = Math.max(0, Number(member.actionReadyAt || 0) - Date.now());
    return remaining <= 0 ? 'PRONTO' : `RECARGA ${(remaining / 1000).toFixed(1)}s`;
  }

  _renderPhase(you, partner, selectedEnemy) {
    const bar = document.getElementById('turn-phase-bar');
    const badge = document.getElementById('turn-phase-badge');
    const text = document.getElementById('turn-phase-text');

    if (bar) {
      bar.className = 'dbz-phase-banner phase-player dokkan-phase-hud squad-phase';
    }

    if (badge) badge.textContent = '[ 2v2 REALTIME ]';

    if (text) {
      const ready = this._memberReadyText(you);
      const targetName = selectedEnemy
        ? selectedEnemy.username || this._leaderName(selectedEnemy)
        : 'SEM ALVO';
      text.textContent = `4 LUTADORES EM CAMPO • ${ready} • ALVO: ${targetName}`;
    }

    const reaction = document.getElementById('reaction-banner');
    reaction?.classList.remove('active');

    const indicator = this._ensureTargetIndicator();
    if (indicator) {
      const partnerStatus = partner ? this._memberReadyText(partner) : '—';
      const target = selectedEnemy ? escapeHtml(selectedEnemy.username || this._leaderName(selectedEnemy)) : 'SEM ALVO';
      indicator.innerHTML = `
        <span class="mab-icon">🎯</span>
        <span class="mab-text">ALVO: ${target}</span>
        <span class="squad-partner-status">PARCEIRO: ${escapeHtml(partnerStatus)}</span>
      `;
    }
  }

  _ensureTargetIndicator() {
    const drop = document.getElementById('drop-zone');
    if (!drop) return null;

    let indicator = document.getElementById('squad-target-indicator');
    if (!indicator) {
      indicator = document.createElement('div');
      indicator.id = 'squad-target-indicator';
      indicator.className = 'minimal-action-badge squad-target-indicator';
      drop.appendChild(indicator);
    }
    return indicator;
  }

  _renderOfficialHand(you) {
    const hand = document.getElementById('p1-hand');
    if (!hand) return;

    hand.replaceChildren();

    const safeYouName = escapeHtml(you.username || 'Voce');
    const safeYouLeader = escapeHtml(you.leader?.name || '');
    hand.dataset.squadPlayer = safeYouName;
    hand.dataset.squadLeader = safeYouLeader;

    const canAct =
      this.state?.state === 'ACTIVE' &&
      !this.state?.finished &&
      !you.downed &&
      !you.abandoned &&
      Date.now() >= Number(you.actionReadyAt || 0);

    (you.hand || []).forEach((card, index) => {
      const effectiveCost = getEffectiveCardCost(you, card);
      const needsTarget = isAttackAction(card);
      const affordable = Number(you.ki || 0) >= effectiveCost;
      const playable = canAct && affordable && (!needsTarget || !!this.selectedTargetUid);

      const el = document.createElement('div');
      el.className =
        `card type-${card.type}` +
        (card.rarity === 'super-rare' ? ' super-rare' : '') +
        (playable ? ' playable' : ' card-phase-disabled');

      el.dataset.index = String(index);
      el.dataset.cardId = card.id || '';

      const safeCardName = escapeHtml(card.name);
      el.setAttribute('aria-label', safeCardName);

      el.innerHTML = `
        ${assetLoader.renderCardArtHTML(card)}
        <div class="card-header"><div class="card-ki-cost">${effectiveCost}</div></div>
        <div class="card-type-tag tag-${escapeHtml(card.type)}">${escapeHtml(String(card.type || '').toUpperCase())}</div>
        ${card.power > 0 ? `<div class="card-power-badge">${Number(card.power)} ATK</div>` : ''}
      `;

      el.draggable = playable;
      el.addEventListener('dragstart', () => {
        if (!playable) return;
        this.draggedCardIndex = index;
        el.classList.add('dragging');
      });
      el.addEventListener('dragend', () => {
        el.classList.remove('dragging');
        this.draggedCardIndex = null;
      });

      el.addEventListener('click', () => {
        if (!playable) return;
        this._playCard(index, card);
      });

      hand.appendChild(el);
    });
  }

  _playCard(index, card) {
    if (!this.onAction || !card) return;

    const targetUid = isAttackAction(card) ? this.selectedTargetUid : null;
    if (isAttackAction(card) && !targetUid) return;

    soundEngine.playClick?.();
    soundEngine.playCardPlay?.();

    this.onAction('playCard', {
      cardIndex: index,
      cardId: card.id,
      targetUid
    });
  }

  _renderActions(you) {
    const canAct =
      this.state?.state === 'ACTIVE' &&
      !this.state?.finished &&
      !you.downed &&
      !you.abandoned &&
      Date.now() >= Number(you.actionReadyAt || 0);

    const charge = document.getElementById('charge-ki-btn');
    const pass = document.getElementById('pass-turn-btn');

    if (charge) {
      charge.disabled = !canAct;
      charge.classList.toggle('overcharge', Number(you.ki || 0) >= 10);
      charge.innerHTML = `<span class="btn-label">${Number(you.ki || 0) >= 10 ? 'KI MÁXIMO' : 'CARREGAR KI'}</span>`;
    }

    if (pass) {
      pass.disabled = !canAct;
      pass.innerHTML = '<span class="btn-label">REPOSICIONAR</span>';
    }
  }

  _renderLogs() {
    const container = document.getElementById('battle-log-container');
    if (!container) return;

    container.replaceChildren();

    (this.state?.logs || []).slice(0, 8).forEach(log => {
      const line = document.createElement('div');
      line.className = `log-line ${log.type || ''}`;
      const safeLogText = escapeHtml(log.text || '');
      const safeTime = escapeHtml(log.time || '');

      // Safe HTML preserves the official battle-log styling while ensuring
      // that server/user strings are encoded first.
      line.innerHTML = safeTime
        ? `<span class="log-time">[${safeTime}]</span> ${safeLogText}`
        : safeLogText;

      container.appendChild(line);
    });
  }

  _renderResult() {
    const state = this.state;
    if (!state?.finished) return;

    const modal = document.getElementById('ko-modal');
    const text = document.getElementById('ko-text');
    if (!modal || !text) return;

    const won = state.teamWinner === state.teamSide;
    text.textContent = won ? 'VITÓRIA DO SEU TIME' : 'DERROTA DO SEU TIME';
    modal.classList.add('active');
    soundEngine.playResult?.(won);
  }

  _renderCooldownOnly() {
    const state = this.state;
    if (!state) return;

    const localSide = state.teamSide;
    const enemySide = localSide === 'A' ? 'B' : 'A';
    const allies = state.teams?.[localSide] || [];
    const enemies = state.teams?.[enemySide] || [];
    const you = state.you || allies.find(member => member.uid === this.localUid) || {};
    const partner = allies.find(member => member.uid !== this.localUid) || null;
    const selectedEnemy = enemies.find(member => member.uid === this.selectedTargetUid) || enemies[0] || null;
    const otherEnemy = enemies.find(member => member.uid !== selectedEnemy?.uid) || null;

    this._renderMainHud('p1', you, { selected: false });
    if (selectedEnemy) this._renderMainHud('p2', selectedEnemy, { selected: true });
    this._renderAuxHud(this.auxAllyHud, partner, { selected: false });
    this._renderAuxHud(this.auxEnemyHud, otherEnemy, { selected: false });
    this._renderPhase(you, partner, selectedEnemy);
    this._renderActions(you);

    const hand = document.getElementById('p1-hand');
    const expectedReady =
      state.state === 'ACTIVE' &&
      !state.finished &&
      !you.downed &&
      !you.abandoned &&
      Date.now() >= Number(you.actionReadyAt || 0);

    if (hand && hand.dataset.squadReady !== String(expectedReady)) {
      hand.dataset.squadReady = String(expectedReady);
      this._renderOfficialHand(you);
    }
  }

  handleFx(payload) {
    if (!payload || payload.type !== 'squad_attack') return;

    const targetUid = payload.data?.targetUid;
    const target =
      document.querySelector(`[data-squad-uid="${CSS.escape(String(targetUid || ''))}"]`);

    if (target) {
      target.classList.remove('squad-hit-flash');
      void target.offsetWidth;
      target.classList.add('squad-hit-flash');
      setTimeout(() => target.classList.remove('squad-hit-flash'), 420);
    }

    const arena = document.getElementById('scene-arena');
    arena?.classList.remove('shake-screen');
    if (arena) {
      void arena.offsetWidth;
      arena.classList.add('shake-screen');
      setTimeout(() => arena.classList.remove('shake-screen'), 350);
    }

    if (payload.data?.card?.isBeam) soundEngine.playBeamDamage?.();
    else soundEngine.playPunch?.();
  }

  render() {
    const state = this.state;
    if (!state) return;

    this._ensureAuxHuds();

    const localSide = state.teamSide;
    const enemySide = localSide === 'A' ? 'B' : 'A';
    const allies = state.teams?.[localSide] || [];
    const enemies = state.teams?.[enemySide] || [];

    const you = state.you || allies.find(member => member.uid === this.localUid) || {};
    const partner = allies.find(member => member.uid !== this.localUid) || null;

    const selectedEnemy =
      enemies.find(member => member.uid === this.selectedTargetUid) ||
      enemies.find(member => !member.downed && !member.abandoned) ||
      enemies[0] ||
      null;

    const otherEnemy =
      enemies.find(member => member.uid !== selectedEnemy?.uid) ||
      null;

    if (selectedEnemy) this.selectedTargetUid = selectedEnemy.uid;

    // Official primary HUDs stay meaningful for the rest of the game:
    // P1 = local fighter, P2 = currently selected target.
    this._renderMainHud('p1', you, { selected: false });
    if (selectedEnemy) this._renderMainHud('p2', selectedEnemy, { selected: true });

    // The two extra combatants extend the same official Scouter HUD language.
    this._renderAuxHud(this.auxAllyHud, partner, { selected: false });
    this._renderAuxHud(this.auxEnemyHud, otherEnemy, { selected: false });

    this._renderPhase(you, partner, selectedEnemy);
    this._renderActions(you);
    this._renderOfficialHand(you);
    this._renderLogs();
    this._renderResult();
  }
}

export const teamBattleUI = new TeamBattleUI();
