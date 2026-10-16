/* ==========================================================================
   Dragon Ball Clash Action TCG — 2v2 Ranked Team Battle Engine
   Suporta 4 Jogadores (Time A vs Time B), Turnos Individuais, Reação 3s,
   Efeitos Visuais e Sonoros idênticos ao 1v1 — SEM tocar no game-engine.js
   ========================================================================== */

import { getCardById, CARD_DATABASE, getStarterDeckForLeader } from './card-database.js';

export class Mode2v2Engine {
  constructor(onStateChange, onLog) {
    this.mode = '2v2';
    this.onStateChange = onStateChange || (() => {});
    this.onLog = onLog || (() => {});
    // onFx(type, data) — conectado pelo ui-manager aos efeitos visuais/sonoros
    this.onFx = null;
    // onTimerTick(secondsLeft, total) — conectado ao timer visual da reaction window
    this.onTimerTick = null;
    // onNetworkSync(state) — conectado pelo multiplayer-manager para broadcast
    this.onNetworkSync = null;

    this.turnSequence = ['p1', 'opp1', 'p2', 'opp2'];
    this.turnIndex = 0;
    this.activeFighterId = 'p1';
    this.selectedTargetId = 'opp1';
    this.pendingAttack = null;
    this.beamClashData = null;
    this.beamClashInterval = null;
    this.reactionTimer = null;
    this.reactionSecondsLeft = 3.0;
    this.aiReacted = false;
    this.winner = null;
    this.state = 'FREE_ACTION'; // FREE_ACTION | ATTACK_PENDING | BEAM_CLASH | GAME_OVER
    this.remotePlayerFighterIds = []; // fighterIds de jogadores humanos remotos
    this.aiTurnTimeout = null;
    this.battleLogs = [];

    this.fighters = {
      p1: {
        id: 'p1', name: 'Guerreiro 1 (Você)', leaderKey: 'goku', team: 'A',
        hp: 400, maxHp: 400, ki: 4, maxKi: 10, shields: 8,
        hand: [], deck: [], discard: [], isAwakened: false, isOpenGuard: false,
        color: '#ff9900'
      },
      p2: {
        id: 'p2', name: 'Aliado Z (P2)', leaderKey: 'vegeta', team: 'A',
        hp: 400, maxHp: 400, ki: 4, maxKi: 10, shields: 8,
        hand: [], deck: [], discard: [], isAwakened: false, isOpenGuard: false,
        color: '#00bfff'
      },
      opp1: {
        id: 'opp1', name: 'Inimigo Alpha', leaderKey: 'frieza', team: 'B',
        hp: 400, maxHp: 400, ki: 4, maxKi: 10, shields: 8,
        hand: [], deck: [], discard: [], isAwakened: false, isOpenGuard: false,
        color: '#a020f0'
      },
      opp2: {
        id: 'opp2', name: 'Inimigo Beta', leaderKey: 'piccolo', team: 'B',
        hp: 400, maxHp: 400, ki: 4, maxKi: 10, shields: 8,
        hand: [], deck: [], discard: [], isAwakened: false, isOpenGuard: false,
        color: '#32cd32'
      }
    };
  }

  /* ── Início da Partida ─────────────────────────────────────────────── */

  startMatch(p1Leader = 'goku', userDeck = [], allPlayers = []) {
    const leaders = {
      p1:   p1Leader,
      p2:   allPlayers[1]?.leader  || 'vegeta',
      opp1: allPlayers[2]?.leader  || 'frieza',
      opp2: allPlayers[3]?.leader  || 'piccolo'
    };
    const names = {
      p1:   `Você (${p1Leader.toUpperCase()})`,
      p2:   allPlayers[1] ? `${allPlayers[1].username} (${leaders.p2.toUpperCase()})` : `Aliado Z (${leaders.p2.toUpperCase()})`,
      opp1: allPlayers[2] ? `${allPlayers[2].username} (${leaders.opp1.toUpperCase()})` : `Inimigo Alpha (${leaders.opp1.toUpperCase()})`,
      opp2: allPlayers[3] ? `${allPlayers[3].username} (${leaders.opp2.toUpperCase()})` : `Inimigo Beta (${leaders.opp2.toUpperCase()})`
    };

    Object.keys(this.fighters).forEach(fid => {
      const f = this.fighters[fid];
      f.leaderKey  = leaders[fid];
      f.name       = names[fid];
      f.hp         = f.maxHp;
      f.ki         = 4;
      f.shields    = Math.ceil(f.maxHp / 50);
      f.isAwakened = false;
      f.isOpenGuard = false;

      let rawDeck = (fid === 'p1' && Array.isArray(userDeck) && userDeck.length >= 10)
        ? [...userDeck]
        : getStarterDeckForLeader(f.leaderKey);

      const deckCards = rawDeck.map(c => typeof c === 'string' ? getCardById(c) : c).filter(Boolean);
      for (let i = deckCards.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deckCards[i], deckCards[j]] = [deckCards[j], deckCards[i]];
      }
      f.deck    = deckCards;
      f.discard = [];
      f.hand    = [];
      for (let k = 0; k < 5; k++) {
        if (f.deck.length > 0) f.hand.push(f.deck.shift());
      }
    });

    this.turnIndex        = 0;
    this.activeFighterId  = this.turnSequence[0];
    this.selectedTargetId = 'opp1';
    this.winner           = null;
    this.state            = 'FREE_ACTION';
    this.pendingAttack    = null;
    this.battleLogs       = [];

    // Identifica jogadores humanos remotos (não-host e não-bot)
    this.remotePlayerFighterIds = [];
    const fighterIdMap = ['p1', 'p2', 'opp1', 'opp2'];
    allPlayers.forEach((p, i) => {
      if (i > 0 && p.uid && !p.uid.startsWith('bot_')) {
        this.remotePlayerFighterIds.push(fighterIdMap[i]);
      }
    });

    this.log(`⚔️ BATALHA RANQUEADA 2v2 INICIADA! Time A vs Time B`, 'info');
    this.notifyState();

    // Se o primeiro turno for de um bot, executa imediatamente
    if (this._isBotFighter(this.activeFighterId)) {
      this.aiTurnTimeout = setTimeout(() => this.executeAiTurn(this.activeFighterId), 1200);
    }
  }

  setPlayerIdentities(allPlayers) {
    const leaders = {
      p1:   allPlayers[0]?.leader  || 'goku',
      p2:   allPlayers[1]?.leader  || 'vegeta',
      opp1: allPlayers[2]?.leader  || 'frieza',
      opp2: allPlayers[3]?.leader  || 'piccolo'
    };
    const names = {
      p1:   `Você (${leaders.p1.toUpperCase()})`,
      p2:   allPlayers[1] ? `${allPlayers[1].username} (${leaders.p2.toUpperCase()})` : `Aliado Z (${leaders.p2.toUpperCase()})`,
      opp1: allPlayers[2] ? `${allPlayers[2].username} (${leaders.opp1.toUpperCase()})` : `Inimigo Alpha (${leaders.opp1.toUpperCase()})`,
      opp2: allPlayers[3] ? `${allPlayers[3].username} (${leaders.opp2.toUpperCase()})` : `Inimigo Beta (${leaders.opp2.toUpperCase()})`
    };
    Object.keys(this.fighters).forEach(fid => {
      this.fighters[fid].leaderKey = leaders[fid];
      this.fighters[fid].name = names[fid];
    });
    this.remotePlayerFighterIds = [];
    const fighterIdMap = ['p1', 'p2', 'opp1', 'opp2'];
    allPlayers.forEach((p, i) => {
      if (i > 0 && p.uid && !p.uid.startsWith('bot_')) {
        this.remotePlayerFighterIds.push(fighterIdMap[i]);
      }
    });
  }

  /* ── Seleção de Alvo ───────────────────────────────────────────────── */

  setTarget(targetId) {
    const actor = this.fighters[this.activeFighterId];
    if (!actor) return;
    const enemyTeam = actor.team === 'A' ? 'B' : 'A';
    if (this.fighters[targetId] && this.fighters[targetId].team === enemyTeam && this.fighters[targetId].hp > 0) {
      this.selectedTargetId = targetId;
      this.notifyState();
    }
  }

  /* ── Carregar Ki — passa o turno ao final (igual ao 1v1) ───────────── */

  chargeKi(fighterId) {
    if (this.state !== 'FREE_ACTION') return false;
    if (this.activeFighterId !== fighterId) return false;

    const actor = this.fighters[fighterId];
    if (!actor || actor.hp <= 0) return false;

    if (actor.ki >= actor.maxKi) {
      this.log(`${actor.name} já está com Ki máximo (${actor.maxKi}/${actor.maxKi} Ki).`, 'info');
    } else {
      actor.ki = Math.min(actor.maxKi, actor.ki + 2);
      this.log(`⚡ ${actor.name} carregou Ki (+2, total ${actor.ki}).`, 'info');
      if (this.onFx) this.onFx('kiAura', { actorId: fighterId, color: actor.color });
    }

    this.notifyState();
    // Igual ao 1v1: carregar Ki encerra o turno
    this._advanceTurn(fighterId);
    return true;
  }

  /* ── Jogar Carta ───────────────────────────────────────────────────── */

  playCard(fighterId, handIndex, targetIdOverride) {
    // ── Fase de Reação (ATTACK_PENDING): qualquer alvo pode reagir ──
    if (this.state === 'ATTACK_PENDING' && this.pendingAttack) {
      if (fighterId === this.pendingAttack.targetId) {
        this.resolveReaction(fighterId, handIndex);
      }
      return;
    }

    if (this.state !== 'FREE_ACTION') return;
    if (this.activeFighterId !== fighterId) return;

    const actor = this.fighters[fighterId];
    if (!actor || actor.hp <= 0) return;
    if (handIndex < 0 || handIndex >= actor.hand.length) return;

    const rawCard = actor.hand[handIndex];
    const card    = typeof rawCard === 'string' ? getCardById(rawCard) : rawCard;
    if (!card) return;

    if (actor.ki < card.cost) {
      this.log(`Ki insuficiente para jogar ${card.name}!`, 'warn');
      return;
    }

    const cardType = card.type || 'attack';

    // Somente cartas de fase principal durante FREE_ACTION com iniciativa
    const mainPhasePlayable = ['attack', 'ki_blast', 'support', 'tech', 'combo'];
    if (!mainPhasePlayable.includes(cardType)) {
      this.log(`${card.name} só pode ser jogado como reação!`, 'warn');
      return;
    }

    // Resolve alvo
    let targetId = targetIdOverride
      || (actor.team === 'A' ? this.selectedTargetId : this._getOpposingTargetId(actor.team));
    let target = this.fighters[targetId];
    if (!target || target.hp <= 0) {
      targetId = this._getOpposingTargetId(actor.team);
      target   = this.fighters[targetId];
    }
    if (!target || target.hp <= 0) {
      this.log(`Nenhum alvo vivo disponível!`, 'warn');
      return;
    }

    // Deduz Ki e remove carta da mão
    actor.ki -= card.cost;
    actor.hand.splice(handIndex, 1);
    actor.discard.push(card.id || card);

    // Support cards: resolve immediately without attack/reaction window
    if (cardType === 'support') {
      this._resolveSupportCard(fighterId, card);
      return;
    }

    const dmg = card.power || 35;
    this.pendingAttack = { attackerId: fighterId, targetId, card, damage: dmg };
    this.state = 'ATTACK_PENDING';

    this.log(`💥 ${actor.name} jogou ${card.name.toUpperCase()} visando ${target.name}!`, 'damage');

    if (typeof soundEngine !== 'undefined' && soundEngine) soundEngine.playCardPlay();

    // FX de charging para beam attacks (igual ao 1v1)
    const isBeam = card.isBeam
      || (card.name || '').toLowerCase().includes('kamehameha')
      || (card.name || '').toLowerCase().includes('galick')
      || (card.name || '').toLowerCase().includes('flash')
      || (card.name || '').toLowerCase().includes('masenko')
      || (card.name || '').toLowerCase().includes('beam')
      || (card.name || '').toLowerCase().includes('genki')
      || (card.name || '').toLowerCase().includes('supernova');

    if (isBeam && this.onFx) {
      this.onFx('attackCharging', { card, attackerKey: fighterId });
    }

    this.notifyState();
    this.startReactionTimer(targetId);
  }

  /* ── Timer de Reação (3s) — idêntico ao 1v1 ───────────────────────── */

  startReactionTimer(targetId) {
    this.clearReactionTimer();
    this.reactionSecondsLeft = 3.0;
    this.aiReacted = false;

    this.reactionTimer = setInterval(() => {
      this.reactionSecondsLeft -= 0.1;
      if (this.onTimerTick) this.onTimerTick(this.reactionSecondsLeft, 3.0);

      // Bot defensor reage em 1.5s restantes (somente se não for jogador remoto)
      if (!this.aiReacted && this.reactionSecondsLeft <= 1.5
          && targetId !== 'p1'
          && !this.remotePlayerFighterIds.includes(targetId)) {
        this.aiReacted = true;
        this._checkAiDefensiveReaction(targetId);
      }

      if (this.reactionSecondsLeft <= 0) {
        this.clearReactionTimer();
        this.resolveUnansweredAttack();
      }
    }, 100);
  }

  clearReactionTimer() {
    if (this.reactionTimer) {
      clearInterval(this.reactionTimer);
      this.reactionTimer = null;
    }
    this.aiReacted = false;
  }

  _checkAiDefensiveReaction(targetId) {
    const defender = this.fighters[targetId];
    if (!defender || defender.hp <= 0 || !this.pendingAttack) return;

    const atkCard = this.pendingAttack.card;

    // Prioridade: beam counter se o ataque for beam
    let defIndex = -1;
    if (atkCard && (atkCard.isBeam || (atkCard.name || '').toLowerCase().includes('kamehameha'))) {
      defIndex = defender.hand.findIndex(raw => {
        const c = typeof raw === 'string' ? getCardById(raw) : raw;
        return c && c.isBeam && c.cost <= defender.ki;
      });
    }
    if (defIndex === -1) {
      defIndex = defender.hand.findIndex(raw => {
        const c = typeof raw === 'string' ? getCardById(raw) : raw;
        return c && (c.type === 'evade' || c.type === 'defense' || c.type === 'counter') && c.cost <= defender.ki;
      });
    }

    if (defIndex !== -1 && Math.random() < 0.65) {
      this.resolveReaction(targetId, defIndex);
    }
  }

  /* ── Resolver Reação do Defensor ───────────────────────────────────── */

  resolveReaction(defenderId, handIndex) {
    if (!this.pendingAttack) return;
    this.clearReactionTimer();

    const defender = this.fighters[defenderId];
    if (!defender) return;

    const rawCard  = defender.hand[handIndex];
    const defCard  = typeof rawCard === 'string' ? getCardById(rawCard) : rawCard;
    if (!defCard || defender.ki < defCard.cost) {
      this.resolveUnansweredAttack();
      return;
    }

    defender.ki -= defCard.cost;
    defender.hand.splice(handIndex, 1);
    defender.discard.push(defCard.id);

    const atkCard  = this.pendingAttack.card;
    const attacker = this.fighters[this.pendingAttack.attackerId];
    const attackerId = this.pendingAttack.attackerId;

    if (defCard.type === 'evade') {
      // Z-VANISH: esquiva completa, defensor fica com guarda aberta
      defender.isOpenGuard = true;
      this.log(`✨ ${defender.name} usou Z-VANISH TELEPORT e esquivou do ataque de ${attacker.name}!`, 'evade');
      if (this.onFx) this.onFx('cardClash', { atkCard, defCard, attackerKey: attackerId, defenderKey: defenderId, mode: 'evade' });
      if (typeof uiManager !== 'undefined' && uiManager) {
        uiManager.triggerActionBanner('Z-VANISH TELEPORT', 'act-evade', '瞬身');
      }
      if (typeof soundEngine !== 'undefined' && soundEngine) soundEngine.playZVanish();

    } else if (defCard.type === 'counter') {
      // Z-COUNTER: bloqueia e contra-ataca o atacante
      defender.isOpenGuard = false;
      const counterDmg = defCard.power || 30;
      if (attacker) attacker.hp = Math.max(0, attacker.hp - counterDmg);
      this.log(`⚡ ${defender.name} usou Z-COUNTER! Bloqueou e causou ${counterDmg} de dano em ${attacker.name}!`, 'evade');
      if (this.onFx) this.onFx('cardClash', { atkCard, defCard, attackerKey: attackerId, defenderKey: defenderId, mode: 'counter' });
      if (typeof uiManager !== 'undefined' && uiManager) {
        uiManager.triggerCardClashAnimation && uiManager.triggerCardClashAnimation(atkCard, defCard, 'counter');
      }

    } else if ((defCard.isBeam || defCard.type === 'beam') && (atkCard && (atkCard.isBeam || atkCard.type === 'beam'))) {
      // BEAM CLASH!
      this.log(`🔥 DISPUTA DE BEAM! ${attacker.name} vs ${defender.name}!`, 'info');
      if (this.onFx) this.onFx('beamClash', { attackerId, defenderId });
      if (typeof uiManager !== 'undefined' && uiManager) {
        uiManager.triggerActionBanner('DISPUTA DE BEAM!', 'act-attack', 'KAMEHAMEHA VS KAMEHAMEHA');
      }
      this.startBeamClashLoop();
      return; // Resolução adiada até o fim do beam clash

    } else if (defCard.type === 'defense' || defCard.type === 'block') {
      // BLOCO: reduz dano
      defender.isOpenGuard = false;
      const blockAmount = defCard.block || Math.floor((atkCard?.power || this.pendingAttack.damage) * 0.5);
      const netDamage   = Math.max(0, this.pendingAttack.damage - blockAmount);
      defender.hp = Math.max(0, defender.hp - netDamage);
      defender.shields = Math.ceil(defender.hp / 50);
      this.log(`🛡️ ${defender.name} usou ${defCard.name} e bloqueou ${blockAmount} de dano! (Dano resultante: ${netDamage})`, 'evade');
      if (this.onFx) this.onFx('cardClash', { atkCard, defCard, attackerKey: attackerId, defenderKey: defenderId, mode: 'defense' });
      if (typeof uiManager !== 'undefined' && uiManager) {
        uiManager.triggerCardClashAnimation && uiManager.triggerCardClashAnimation(atkCard, defCard, 'defense');
      }

    } else {
      // Carta não é de reação — trata como bloco parcial
      const fallbackDmg = Math.floor(this.pendingAttack.damage * 0.5);
      defender.hp = Math.max(0, defender.hp - fallbackDmg);
      defender.shields = Math.ceil(defender.hp / 50);
      this.log(`🛡️ ${defender.name} usou ${defCard.name} e reduziu o dano para ${fallbackDmg}!`, 'evade');
    }

    this._finishAttackResolution();
  }

  /* ── Ataque Sem Resposta ───────────────────────────────────────────── */

  resolveUnansweredAttack() {
    if (!this.pendingAttack) return;

    const { attackerId, targetId, card, damage } = this.pendingAttack;
    const target   = this.fighters[targetId];
    const attacker = this.fighters[attackerId];

    if (target && card) {
      // Aplica dano
      let dmg = damage;
      if (target.isOpenGuard) dmg = Math.floor(dmg * 1.5);

      const prevShields = target.shields;
      target.hp       = Math.max(0, target.hp - dmg);
      target.shields  = Math.ceil(target.hp / 50);
      target.isOpenGuard = false;

      // FX de ataque idêntico ao 1v1
      this._playAttackFX(card, attackerId, dmg);

      // Log
      this.log(`${attacker.name} acertou ${card.name} causando ${dmg} de dano em ${target.name}!`, 'damage');

      // Passive: Gohan compra 2 cartas ao destruir escudo
      if (attacker.leaderKey === 'gohan' && prevShields > target.shields) {
        this._drawCard(attacker, 2);
        this.log(`💥 Passive Gohan: Escudo destruído! Comprou 2 cartas.`, 'info');
      }
      // Passive: Goku ganha +1 Ki ao receber dano direto
      if (target.leaderKey === 'goku' && target.ki < target.maxKi) {
        target.ki = Math.min(target.maxKi, target.ki + 1);
        this.log(`⚡ Passive Goku: +1 Ki por receber dano!`, 'info');
      }
    }

    this._finishAttackResolution();
  }

  /* ── FX de Ataque — espelho exato do game-engine.js ───────────────── */

  _playAttackFX(card, attackerKey, dmg) {
    if (!card || !this.onFx) return;

    const cardNameLower = (card.name || '').toLowerCase();
    const cardIdLower   = (card.id   || '').toLowerCase();

    if (cardIdLower.includes('genkidama') || cardNameLower.includes('genki') || cardNameLower.includes('spirit bomb')) {
      this.onFx('genkidama', { card, attackerKey, damage: dmg });
    } else if (cardIdLower.includes('final_flash') || cardNameLower.includes('final flash')) {
      this.onFx('finalFlash', { card, attackerKey, damage: dmg });
    } else if (cardIdLower.includes('death_beam') || cardNameLower.includes('death beam')) {
      this.onFx('deathBeam', { card, attackerKey, damage: dmg });
    } else if (cardIdLower.includes('special_beam') || cardNameLower.includes('makankosappo') || cardNameLower.includes('special beam')) {
      this.onFx('specialBeam', { card, attackerKey, damage: dmg });
    } else if (cardIdLower.includes('masenko') || cardNameLower.includes('masenko')) {
      this.onFx('masenko', { card, attackerKey, damage: dmg });
    } else if (cardIdLower.includes('big_bang') || cardNameLower.includes('big bang')) {
      this.onFx('bigBang', { card, attackerKey, damage: dmg });
    } else if (cardIdLower.includes('burning') || cardNameLower.includes('burning attack')) {
      this.onFx('burningAttack', { card, attackerKey, damage: dmg });
    } else if (cardIdLower.includes('supernova') || cardNameLower.includes('supernova') || cardNameLower.includes('death ball')) {
      this.onFx('supernova', { card, attackerKey, damage: dmg });
    } else if (cardIdLower.includes('kienzan') || cardNameLower.includes('kienzan') || cardNameLower.includes('destructo disc')) {
      this.onFx('kienzan', { card, attackerKey, damage: dmg });
    } else if (cardIdLower.includes('kikoho') || cardNameLower.includes('kikoho') || cardNameLower.includes('tri-beam')) {
      this.onFx('kikoho', { card, attackerKey, damage: dmg });
    } else if (cardIdLower.includes('dragon_fist') || cardNameLower.includes('dragon fist')) {
      this.onFx('dragonFist', { card, attackerKey, damage: dmg });
    } else if (cardIdLower.includes('meteor') || cardNameLower.includes('meteor combination') || cardNameLower.includes('combo')) {
      this.onFx('meteorCombination', { card, attackerKey, damage: dmg });
    } else if (cardIdLower.includes('spirit_sword') || cardNameLower.includes('spirit sword') || cardNameLower.includes('sword slash')) {
      this.onFx('spiritSword', { card, attackerKey, damage: dmg });
    } else if (cardNameLower.includes('solar flare') || cardNameLower.includes('taiyoken')) {
      this.onFx('solarFlare', { card, attackerKey });
    } else if (cardNameLower.includes('time skip')) {
      this.onFx('timeSkip', { card, attackerKey });
    } else if (card.isBeam || cardNameLower.includes('kamehameha') || cardNameLower.includes('galick gun')) {
      const attacker = this.fighters[attackerKey];
      this.onFx('kamehameha', { card, attackerKey, isGolden: attacker?.isAwakened, damage: dmg });
    } else if (card.type === 'ki_blast' || cardNameLower.includes('ki blast')) {
      this.onFx('kiBlast', { card, attackerKey, damage: dmg });
    } else {
      this.onFx('punch', { card, attackerKey, damage: dmg });
    }
  }

  /* ── Finalizar Resolução de Ataque ─────────────────────────────────── */

  _finishAttackResolution() {
    const prevAttackerId = this.pendingAttack?.attackerId;
    this.pendingAttack = null;
    this.state = 'FREE_ACTION';

    Object.values(this.fighters).forEach(f => this._checkAwaken(f));
    this._checkGameOver();

    if (!this.winner) {
      // Após ataque, turno vai para o próximo jogador
      this._advanceTurn(prevAttackerId || this.activeFighterId);
    } else {
      this.notifyState();
    }
  }

  /* ── Resolver Carta de Suporte (Heal/Draw/Buff sem janela de reação) ── */

  _resolveSupportCard(fighterId, card) {
    const actor = this.fighters[fighterId];
    if (!actor) return;
    this.log(`✨ ${actor.name} usou a carta de Suporte: ${card.name}!`, 'info');

    if (card.selfHpCost) {
      actor.hp = Math.max(1, actor.hp - card.selfHpCost);
      actor.shields = Math.ceil(actor.hp / 50);
      this.log(`🔴 ${actor.name} sacrificou ${card.selfHpCost} HP!`, 'damage');
    }
    if (card.healHp || card.heal) {
      const healAmount = card.healHp || card.heal;
      actor.hp = Math.min(actor.maxHp, actor.hp + healAmount);
      actor.shields = Math.ceil(actor.hp / 50);
      this.log(`💚 ${actor.name} restaurou +${healAmount} HP! (HP: ${actor.hp}/${actor.maxHp})`, 'info');
    }
    if (card.kiGain) {
      actor.ki = Math.min(actor.maxKi, actor.ki + card.kiGain);
      this.log(`⚡ ${actor.name} recebeu +${card.kiGain} Ki! (Ki: ${actor.ki}/${actor.maxKi})`, 'info');
    }
    if (card.drawCards) {
      this._drawCard(actor, card.drawCards);
      this.log(`🃏 ${actor.name} comprou ${card.drawCards} carta(s)!`, 'info');
    }
    if (card.buffAtk) {
      actor.nextAttackBuff = (actor.nextAttackBuff || 0) + card.buffAtk;
      this.log(`👑 Próximo ataque de ${actor.name} terá +${card.buffAtk} de dano bônus!`, 'info');
    }
    if (this.onFx) this.onFx('healSupport', { actorKey: fighterId, card });

    this.notifyState();
    this._advanceTurn(fighterId);
  }

  /* ── Passar Turno (botão explícito do jogador) ─────────────────────── */

  passTurn(requestingFighterId) {
    if (this.state !== 'FREE_ACTION') return;
    const fid = requestingFighterId || this.activeFighterId;
    if (this.activeFighterId !== fid) return;
    this._advanceTurn(fid);
  }

  /* ── Avança para o próximo turno ───────────────────────────────────── */

  _advanceTurn(fromFighterId) {
    if (this.winner) return;
    // Guard against re-entrant calls
    if (this._isAdvancingTurn) return;
    this._isAdvancingTurn = true;

    // Cancela timeout de AI pendente
    if (this.aiTurnTimeout) {
      clearTimeout(this.aiTurnTimeout);
      this.aiTurnTimeout = null;
    }

    // Avança na sequência pulando lutadores mortos
    let attempts = 0;
    do {
      this.turnIndex = (this.turnIndex + 1) % this.turnSequence.length;
      this.activeFighterId = this.turnSequence[this.turnIndex];
      attempts++;
    } while (this.fighters[this.activeFighterId]?.hp <= 0 && attempts < this.turnSequence.length);

    // If no one is alive, bail
    if (attempts >= this.turnSequence.length && this.fighters[this.activeFighterId]?.hp <= 0) {
      this._isAdvancingTurn = false;
      return;
    }

    const activeActor = this.fighters[this.activeFighterId];
    if (activeActor && activeActor.hp > 0) {
      // Ganha +1 Ki e compra 1 carta ao receber o turno (igual ao 1v1)
      activeActor.ki = Math.min(activeActor.maxKi, activeActor.ki + 1);
      this._drawCard(activeActor, 1);
      this.log(`🔄 Turno de ${activeActor.name} (+1 Ki, comprou 1 carta)`, 'info');
    }

    this.notifyState();
    this._isAdvancingTurn = false;

    // Se o lutador ativo for bot, executa AI após delay
    if (this._isBotFighter(this.activeFighterId) && !this.winner) {
      this.aiTurnTimeout = setTimeout(() => this.executeAiTurn(this.activeFighterId), 1200);
    }
  }

  /* ── Comprar Carta ─────────────────────────────────────────────────── */

  _drawCard(fighter, count = 1) {
    for (let c = 0; c < count; c++) {
      if (fighter.hand.length >= 7) break;
      if (!fighter.deck || fighter.deck.length === 0) {
        if (fighter.discard && fighter.discard.length > 0) {
          const rawDiscard = fighter.discard.map(x => typeof x === 'string' ? getCardById(x) : x).filter(Boolean);
          if (rawDiscard.length === 0) {
            // All discarded cards resolved to null — regenerate from leader starter deck
            fighter.deck = getStarterDeckForLeader(fighter.leaderKey || 'goku')
              .map(x => typeof x === 'string' ? getCardById(x) : x).filter(Boolean);
          } else {
            fighter.deck = [...rawDiscard];
          }
          fighter.discard = [];
          for (let i = fighter.deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [fighter.deck[i], fighter.deck[j]] = [fighter.deck[j], fighter.deck[i]];
          }
        } else {
          fighter.deck = getStarterDeckForLeader(fighter.leaderKey || 'goku')
            .map(x => typeof x === 'string' ? getCardById(x) : x).filter(Boolean);
        }
      }
      if (fighter.deck.length > 0) {
        const drawnCard = fighter.deck.shift();
        if (drawnCard) fighter.hand.push(drawnCard);
      }
    }
  }

  /* ── AI: Turno Automático ──────────────────────────────────────────── */

  executeAiTurn(aiId) {
    this.aiTurnTimeout = null;
    if (this.activeFighterId !== aiId) return;
    const ai = this.fighters[aiId];
    if (!ai || ai.hp <= 0 || this.winner) return;
    if (this.state !== 'FREE_ACTION') return;

    // Seleciona alvo inimigo
    const enemies = Object.values(this.fighters).filter(f => f.team !== ai.team && f.hp > 0);
    if (enemies.length === 0) return;
    const target = enemies[Math.floor(Math.random() * enemies.length)];

    const hand       = ai.hand;
    const currentKi  = ai.ki;
    const hpRatio    = ai.hp / ai.maxHp;

    // Avalia cartas com scoring tático (igual ao 1v1)
    const mainPhasePlayable = ['attack', 'ki_blast', 'support', 'tech', 'combo'];
    const affordable = hand
      .map((raw, index) => {
        const card = typeof raw === 'string' ? getCardById(raw) : raw;
        return card && card.cost <= currentKi && mainPhasePlayable.includes(card.type || 'attack') ? { card, index } : null;
      })
      .filter(Boolean);

    if (affordable.length === 0) {
      if (currentKi < ai.maxKi) {
        this.chargeKi(aiId);
      } else {
        this._advanceTurn(aiId);
      }
      return;
    }

    const scored = affordable.map(item => {
      const c = item.card;
      let score = 10;
      if (c.type === 'attack' || c.damage > 0 || c.isBeam) {
        score += c.power || c.damage || 40;
        if (c.isBeam || c.rarity === 'super-rare') score += 50;
        const lowestEnemyHp = enemies.reduce((m, f) => Math.min(m, f.hp), 9999);
        if (lowestEnemyHp <= (c.power || 40) + 40) score += 250;
      }
      if (c.heal > 0 && hpRatio <= 0.5) score += 120;
      if (c.cost > 0 && (c.power || 0) > 0) score += ((c.power || 0) / c.cost) * 12;
      return { ...item, score };
    });
    scored.sort((a, b) => b.score - a.score);
    const best = scored[0];

    if (best.score < 40 && currentKi <= 5 && Math.random() > 0.25) {
      this.chargeKi(aiId);
      return;
    }

    this.playCard(aiId, best.index, target.id);
  }

  /* ── BEAM CLASH ────────────────────────────────────────────────────── */

  startBeamClashLoop() {
    this.clearBeamClashLoop();
    this.state = 'BEAM_CLASH';
    this.beamClashData = { p1Progress: 50, timer: 6.0 };
    this.log(`🔥 DISPUTA DE BEAM KAMEHAMEHA! Pressione o botão rapidamente!`, 'info');

    this.beamClashInterval = setInterval(() => {
      if (this.state !== 'BEAM_CLASH' || !this.beamClashData) {
        this.clearBeamClashLoop();
        return;
      }
      const attackerId = this.pendingAttack?.attackerId;
      const defenderId = this.pendingAttack?.targetId;

      this.beamClashData.p1Progress = Math.max(0, this.beamClashData.p1Progress - 1.2);
      this.beamClashData.timer -= 0.1;

      const atkColor = this.fighters[attackerId]?.color || '#00f2fe';
      const defColor = this.fighters[defenderId]?.color || '#ffd700';
      if (this.onFx) this.onFx('beamClash', { p1Progress: this.beamClashData.p1Progress, p1Color: atkColor, p2Color: defColor });

      this.notifyState();

      if (this.beamClashData.p1Progress <= 0) {
        this.clearBeamClashLoop();
        this.resolveBeamClashWinner(defenderId);
      } else if (this.beamClashData.p1Progress >= 100) {
        this.clearBeamClashLoop();
        this.resolveBeamClashWinner(attackerId);
      } else if (this.beamClashData.timer <= 0) {
        this.clearBeamClashLoop();
        const winnerId = this.beamClashData.p1Progress >= 50 ? attackerId : defenderId;
        this.resolveBeamClashWinner(winnerId);
      }
    }, 100);
  }

  mashBeamClash(fighterId) {
    if (this.state !== 'BEAM_CLASH' || !this.beamClashData || !this.pendingAttack) return;

    const attackerId = this.pendingAttack.attackerId;
    const defenderId = this.pendingAttack.targetId;

    if (fighterId === attackerId) {
      this.beamClashData.p1Progress = Math.min(100, this.beamClashData.p1Progress + 7);
    } else if (fighterId === defenderId) {
      this.beamClashData.p1Progress = Math.max(0, this.beamClashData.p1Progress - 7);
    }

    const atkColor = this.fighters[attackerId]?.color || '#00f2fe';
    const defColor = this.fighters[defenderId]?.color || '#ffd700';
    if (this.onFx) this.onFx('beamClash', { p1Progress: this.beamClashData.p1Progress, p1Color: atkColor, p2Color: defColor });

    this.notifyState();

    if (this.beamClashData.p1Progress >= 100) {
      this.clearBeamClashLoop();
      this.resolveBeamClashWinner(attackerId);
    } else if (this.beamClashData.p1Progress <= 0) {
      this.clearBeamClashLoop();
      this.resolveBeamClashWinner(defenderId);
    }
  }

  clearBeamClashLoop() {
    if (this.beamClashInterval) {
      clearInterval(this.beamClashInterval);
      this.beamClashInterval = null;
    }
  }

  resolveBeamClashWinner(winnerId) {
    if (!this.pendingAttack) return;
    this.clearBeamClashLoop();
    this.beamClashData = null;

    const attackerId = this.pendingAttack.attackerId;
    const winner = this.fighters[winnerId];
    const loserId = winnerId === attackerId ? this.pendingAttack.targetId : attackerId;
    const loser   = this.fighters[loserId];

    const beamDmg = 80;
    if (loser) {
      loser.hp      = Math.max(0, loser.hp - beamDmg);
      loser.shields = Math.ceil(loser.hp / 50);
    }

    this.log(`💥 ${winner?.name || winnerId} venceu a DISPUTA DE BEAM! Causou ${beamDmg} de dano massivo em ${loser?.name || loserId}!`, 'damage');
    if (this.onFx) this.onFx('kamehameha', { attackerKey: winnerId, isGolden: true, damage: beamDmg });
    if (typeof uiManager !== 'undefined' && uiManager) {
      uiManager.triggerActionBanner('BEAM VENCIDA!', 'act-attack', `${winner?.name || winnerId} 💥`);
    }

    this._finishAttackResolution();
  }

  /* ── Awaken ────────────────────────────────────────────────────────── */

  _checkAwaken(actor) {
    if (!actor || actor.isAwakened) return;
    const threshold = actor.maxHp * 0.5;
    if (actor.hp <= threshold) {
      actor.isAwakened = true;
      actor.maxKi = Math.min(12, actor.maxKi + 2);
      actor.ki    = Math.min(actor.maxKi, actor.ki + 4);
      this.log(`🔥 ${actor.name} DESPERTOU O PODER TOTAL (AWAKEN)!`, 'awaken');
      if (this.onFx) this.onFx('awaken', { color: actor.color, actorId: actor.id });
      if (typeof soundEngine !== 'undefined' && soundEngine) soundEngine.playAwaken();
      if (typeof uiManager !== 'undefined' && uiManager) {
        uiManager.triggerActionBanner(`${actor.name} DESPERTOU!`, 'act-awaken', 'POWER AWAKENED');
      }
    }
  }

  /* ── Checar Fim de Jogo ────────────────────────────────────────────── */

  _checkGameOver() {
    const teamAAlive = Object.values(this.fighters).some(f => f.team === 'A' && f.hp > 0);
    const teamBAlive = Object.values(this.fighters).some(f => f.team === 'B' && f.hp > 0);

    if (!teamBAlive) {
      this.winner = 'Team A';
      this.state  = 'GAME_OVER';
      this.log(`🏆 VITÓRIA DO SEU TIME NO 2v2!`, 'awaken');
      if (typeof uiManager !== 'undefined' && uiManager) {
        uiManager.triggerActionBanner('K.O.! VITÓRIA DO TIME A', 'act-attack', 'TIME A WINS');
        setTimeout(() => uiManager.showGameResult && uiManager.showGameResult(true), 1800);
      }
    } else if (!teamAAlive) {
      this.winner = 'Team B';
      this.state  = 'GAME_OVER';
      this.log(`💀 DERROTA DO SEU TIME NO 2v2...`, 'damage');
      if (typeof uiManager !== 'undefined' && uiManager) {
        uiManager.triggerActionBanner('K.O.! VITÓRIA DO TIME B', 'act-charge', 'TIME B WINS');
        setTimeout(() => uiManager.showGameResult && uiManager.showGameResult(false), 1800);
      }
    }
  }

  /* ── Helpers ───────────────────────────────────────────────────────── */

  _getOpposingTargetId(myTeam) {
    const enemies = Object.values(this.fighters).filter(f => f.team !== myTeam && f.hp > 0);
    return enemies.length > 0 ? enemies[0].id : null;
  }

  _isBotFighter(fighterId) {
    // É bot se não for 'p1' (host local) e não estiver na lista de jogadores remotos
    return fighterId !== 'p1' && !this.remotePlayerFighterIds.includes(fighterId);
  }

  log(text, type = 'info') {
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const entry = { timestamp, text, type, time: timestamp };
    this.battleLogs.unshift(entry);
    if (this.battleLogs.length > 50) this.battleLogs.pop();
    this.onLog(entry);
  }

  notifyState() {
    const pubState = this.getPublicState();
    this.onStateChange(pubState);
    if (this.onNetworkSync) this.onNetworkSync(pubState);
  }

  getPublicState() {
    return {
      mode:                   '2v2',
      fighters:               this.fighters,
      activeFighterId:        this.activeFighterId,
      selectedTargetId:       this.selectedTargetId,
      turnIndex:              this.turnIndex,
      pendingAttack:          this.pendingAttack,
      beamClashData:          this.state === 'BEAM_CLASH' ? this.beamClashData : null,
      reactionSecondsLeft:    this.reactionSecondsLeft,
      winner:                 this.winner,
      state:                  this.state,
      remotePlayerFighterIds: this.remotePlayerFighterIds,
      battleLogs:             this.battleLogs.slice(0, 8)
    };
  }

  getState() { return this.getPublicState(); }

  applyFullState(remoteState) {
    if (!remoteState) return;
    this.fighters               = remoteState.fighters;
    this.activeFighterId        = remoteState.activeFighterId;
    this.selectedTargetId       = remoteState.selectedTargetId;
    this.turnIndex              = remoteState.turnIndex;
    this.pendingAttack          = remoteState.pendingAttack;
    this.beamClashData          = remoteState.beamClashData || null;
    this.reactionSecondsLeft    = remoteState.reactionSecondsLeft || 3.0;
    this.winner                 = remoteState.winner;
    this.state                  = remoteState.state;
    if (remoteState.remotePlayerFighterIds) {
      this.remotePlayerFighterIds = remoteState.remotePlayerFighterIds;
    }
    if (remoteState.battleLogs) {
      this.battleLogs = remoteState.battleLogs;
    }
    // Non-host não roda o loop local de beam clash
    if (this.state !== 'BEAM_CLASH') this.clearBeamClashLoop();
    // Cancela AI timeouts locais — segue estado do host
    if (this.aiTurnTimeout) {
      clearTimeout(this.aiTurnTimeout);
      this.aiTurnTimeout = null;
    }
    if (this.visualReactionTimer) {
      clearInterval(this.visualReactionTimer);
      this.visualReactionTimer = null;
    }
    // Atualiza timer visual de reaction no non-host
    if (this.state === 'ATTACK_PENDING' && this.onTimerTick) {
      this.onTimerTick(this.reactionSecondsLeft, 3.0);
      let timeLeft = this.reactionSecondsLeft;
      this.visualReactionTimer = setInterval(() => {
        timeLeft -= 0.1;
        if (timeLeft <= 0) {
          timeLeft = 0;
          clearInterval(this.visualReactionTimer);
        }
        this.onTimerTick(timeLeft, 3.0);
      }, 100);
    }
    this.onStateChange(remoteState);
  }
}
