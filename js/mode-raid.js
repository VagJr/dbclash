/* ==========================================================================
   Dragon Ball Clash Action TCG — 4-Player Co-Op Raid Boss Engine
   Suporta 4 Jogadores (Team Z) vs 1 Mega Boss, Turnos Individuais, Reação 3s,
   Efeitos Visuais e Sonoros idênticos ao 1v1 — SEM tocar no game-engine.js
   ========================================================================== */

import { getCardById, CARD_DATABASE, getStarterDeckForLeader } from './card-database.js';
import { RAID_BOSSES } from './raid-engine.js';

export class ModeRaidEngine {
  constructor(onStateChange, onLog) {
    this.mode = 'raid';
    this.onStateChange = onStateChange || (() => {});
    this.onLog = onLog || (() => {});
    // onFx(type, data) — conectado pelo ui-manager aos efeitos visuais/sonoros
    this.onFx = null;
    // onTimerTick(secondsLeft, total) — conectado ao timer visual da reaction window
    this.onTimerTick = null;
    // onNetworkSync(state) — conectado pelo multiplayer-manager para broadcast
    this.onNetworkSync = null;

    this.turnSequence = ['p1', 'p2', 'p3', 'p4', 'boss'];
    this.turnIndex = 0;
    this.activeFighterId = 'p1';
    this.selectedTargetId = 'boss';
    this.pendingAttack = null;
    this.beamClashData = null;
    this.beamClashInterval = null;
    this.reactionTimer = null;
    this.reactionSecondsLeft = 3.0;
    this.winner = null;
    this.state = 'FREE_ACTION'; // FREE_ACTION | BOSS_PHASE | ATTACK_PENDING | BEAM_CLASH | GAME_OVER
    this.remotePlayerFighterIds = [];
    this.aiTurnTimeout = null;
    this.battleLogs = [];

    this.boss = null;
    this.players = {
      p1: { id: 'p1', name: 'Você (Goku)',        leaderKey: 'goku',   hp: 400, maxHp: 400, ki: 4, maxKi: 10, shields: 8, hand: [], deck: [], discard: [], isAwakened: false, color: '#ff9900' },
      p2: { id: 'p2', name: 'Guerreiro 2 (Vegeta)',leaderKey: 'vegeta', hp: 400, maxHp: 400, ki: 4, maxKi: 10, shields: 8, hand: [], deck: [], discard: [], isAwakened: false, color: '#00bfff' },
      p3: { id: 'p3', name: 'Guerreiro 3 (Gohan)', leaderKey: 'gohan',  hp: 400, maxHp: 400, ki: 4, maxKi: 10, shields: 8, hand: [], deck: [], discard: [], isAwakened: false, color: '#a020f0' },
      p4: { id: 'p4', name: 'Guerreiro 4 (Trunks)',leaderKey: 'trunks', hp: 400, maxHp: 400, ki: 4, maxKi: 10, shields: 8, hand: [], deck: [], discard: [], isAwakened: false, color: '#ff1493' }
    };
  }

  /* ── Início da Raid ────────────────────────────────────────────────── */

  startRaid(bossId = 'cell_max', userLeader = 'goku', userDeck = [], allPlayers = []) {
    const bossTemplate = RAID_BOSSES[bossId] || RAID_BOSSES.cell_max;
    this.boss = {
      id: 'boss',
      bossId:         bossTemplate.id,
      name:           bossTemplate.name,
      hp:             bossTemplate.hp,
      maxHp:          bossTemplate.maxHp,
      ki:             6,
      maxKi:          10,
      color:          bossTemplate.color,
      portrait:       bossTemplate.portrait,
      ultimateAttack: bossTemplate.ultimateAttack,
      ultimateDamage: bossTemplate.ultimateDamage,
      isEnraged:      false
    };

    const leaders = {
      p1: userLeader,
      p2: allPlayers[1]?.leader || 'vegeta',
      p3: allPlayers[2]?.leader || 'gohan',
      p4: allPlayers[3]?.leader || 'trunks'
    };
    const names = {
      p1: `Você (${userLeader.toUpperCase()})`,
      p2: allPlayers[1] ? `${allPlayers[1].username} (${leaders.p2.toUpperCase()})` : `Guerreiro 2 (${leaders.p2.toUpperCase()})`,
      p3: allPlayers[2] ? `${allPlayers[2].username} (${leaders.p3.toUpperCase()})` : `Guerreiro 3 (${leaders.p3.toUpperCase()})`,
      p4: allPlayers[3] ? `${allPlayers[3].username} (${leaders.p4.toUpperCase()})` : `Guerreiro 4 (${leaders.p4.toUpperCase()})`
    };

    Object.keys(this.players).forEach(pid => {
      const p = this.players[pid];
      p.leaderKey  = leaders[pid];
      p.name       = names[pid];
      p.hp         = p.maxHp;
      p.ki         = 4;
      p.shields    = Math.ceil(p.maxHp / 50);
      p.isAwakened = false;

      let rawDeck = (pid === 'p1' && Array.isArray(userDeck) && userDeck.length >= 10)
        ? [...userDeck]
        : getStarterDeckForLeader(p.leaderKey);

      const deckCards = rawDeck.map(c => typeof c === 'string' ? getCardById(c) : c).filter(Boolean);
      for (let i = deckCards.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deckCards[i], deckCards[j]] = [deckCards[j], deckCards[i]];
      }
      p.deck    = deckCards;
      p.discard = [];
      p.hand    = [];
      for (let k = 0; k < 5; k++) {
        if (p.deck.length > 0) p.hand.push(p.deck.shift());
      }
    });

    this.turnIndex       = 0;
    this.activeFighterId = this.turnSequence[0];
    this.selectedTargetId = 'boss';
    this.winner          = null;
    this.state           = 'FREE_ACTION';
    this.pendingAttack   = null;
    this.battleLogs      = [];

    this.remotePlayerFighterIds = [];
    const playerIdMap = ['p1', 'p2', 'p3', 'p4'];
    allPlayers.forEach((p, i) => {
      if (i > 0 && p.uid && !p.uid.startsWith('bot_')) {
        this.remotePlayerFighterIds.push(playerIdMap[i]);
      }
    });

    this.log(`🐉 RAID COOPERATIVO INICIADO! 4 Guerreiros Z vs ${this.boss.name} (${this.boss.hp} HP)`, 'info');
    this.notifyState();

    // Se o primeiro turno for de bot, executa imediatamente
    if (this._isBotPlayer(this.activeFighterId)) {
      this.aiTurnTimeout = setTimeout(() => this.executeTeammateAiTurn(this.activeFighterId), 1200);
    }
  }

  setPlayerIdentities(allPlayers) {
    const leaders = {
      p1: allPlayers[0]?.leader || 'goku',
      p2: allPlayers[1]?.leader || 'vegeta',
      p3: allPlayers[2]?.leader || 'gohan',
      p4: allPlayers[3]?.leader || 'trunks'
    };
    const names = {
      p1: `Você (${leaders.p1.toUpperCase()})`,
      p2: allPlayers[1] ? `${allPlayers[1].username} (${leaders.p2.toUpperCase()})` : `Guerreiro 2 (${leaders.p2.toUpperCase()})`,
      p3: allPlayers[2] ? `${allPlayers[2].username} (${leaders.p3.toUpperCase()})` : `Guerreiro 3 (${leaders.p3.toUpperCase()})`,
      p4: allPlayers[3] ? `${allPlayers[3].username} (${leaders.p4.toUpperCase()})` : `Guerreiro 4 (${leaders.p4.toUpperCase()})`
    };
    Object.keys(this.players).forEach(pid => {
      this.players[pid].leaderKey = leaders[pid];
      this.players[pid].name = names[pid];
    });
    this.remotePlayerFighterIds = [];
    const playerIdMap = ['p1', 'p2', 'p3', 'p4'];
    allPlayers.forEach((p, i) => {
      if (i > 0 && p.uid && !p.uid.startsWith('bot_')) {
        this.remotePlayerFighterIds.push(playerIdMap[i]);
      }
    });
  }

  setTarget(targetId) {
    this.selectedTargetId = targetId;
    this.notifyState();
  }

  /* ── Carregar Ki — passa turno ao final (igual ao 1v1) ─────────────── */

  chargeKi(playerId) {
    if (this.state !== 'FREE_ACTION') return false;
    if (this.activeFighterId !== playerId) return false;

    const actor = this.players[playerId];
    if (!actor || actor.hp <= 0) return false;

    if (actor.ki >= actor.maxKi) {
      this.log(`${actor.name} já está com Ki máximo (${actor.maxKi}/${actor.maxKi} Ki).`, 'info');
    } else {
      actor.ki = Math.min(actor.maxKi, actor.ki + 2);
      this.log(`⚡ ${actor.name} carregou Ki (+2, total ${actor.ki}).`, 'info');
      if (this.onFx) this.onFx('kiAura', { actorId: playerId, color: actor.color });
    }

    this.notifyState();
    // Igual ao 1v1: carregar Ki encerra o turno do jogador
    this._advanceTurn(playerId);
    return true;
  }

  /* ── Jogar Carta ───────────────────────────────────────────────────── */

  playCard(playerId, handIndex) {
    // ── Reação durante ATTACK_PENDING ──
    // Na Raid, o boss ataca players: o player-alvo pode reagir
    if (this.state === 'ATTACK_PENDING' && this.pendingAttack) {
      if (playerId === this.pendingAttack.targetId) {
        this.resolveReaction(playerId, handIndex);
      }
      return;
    }

    if (this.state !== 'FREE_ACTION') return;
    if (this.activeFighterId !== playerId) return;

    const actor = this.players[playerId];
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

    // Somente cartas de fase principal durante FREE_ACTION
    const mainPhasePlayable = ['attack', 'ki_blast', 'support', 'tech', 'combo'];
    if (!mainPhasePlayable.includes(cardType)) {
      this.log(`${card.name} só pode ser jogado como reação!`, 'warn');
      return;
    }

    actor.ki -= card.cost;
    actor.hand.splice(handIndex, 1);
    actor.discard.push(card.id);

    // Support cards: resolve immediately without attack/reaction window
    if (cardType === 'support') {
      this._resolveSupportCard(playerId, card);
      return;
    }

    // Bônus de dano do boss (chefe é mais resistente)
    const rawDmg = (card.power || 40) + 20;

    this.pendingAttack = {
      attackerId: playerId,
      targetId:   'boss',
      card,
      damage:     rawDmg
    };
    this.state = 'ATTACK_PENDING';

    this.log(`💥 ${actor.name} jogou ${card.name.toUpperCase()} contra ${this.boss.name} (${rawDmg} de dano)!`, 'damage');

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
      this.onFx('attackCharging', { card, attackerKey: playerId });
    }

    this.notifyState();
    // Boss sempre tem 3s de reaction window (não reage — só espera timeout ou outro player não pode reagir)
    this.startReactionTimer('boss');
  }

  /* ── Timer de Reação (3s) ───────────────────────────────────────────── */

  startReactionTimer(targetId) {
    this.clearReactionTimer();
    this.reactionSecondsLeft = 3.0;

    this.reactionTimer = setInterval(() => {
      this.reactionSecondsLeft -= 0.1;
      if (this.onTimerTick) this.onTimerTick(this.reactionSecondsLeft, 3.0);

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
  }

  /* ── Resolver Reação (boss atacando um player) ─────────────────────── */

  resolveReaction(defenderId, handIndex) {
    if (!this.pendingAttack) return;
    this.clearReactionTimer();

    // Reação somente faz sentido quando o boss está atacando um player
    const defender = this.players[defenderId];
    if (!defender) return;

    const rawCard = defender.hand[handIndex];
    const defCard = typeof rawCard === 'string' ? getCardById(rawCard) : rawCard;
    if (!defCard || defender.ki < defCard.cost) {
      this.resolveUnansweredAttack();
      return;
    }

    defender.ki -= defCard.cost;
    defender.hand.splice(handIndex, 1);
    defender.discard.push(defCard.id);

    const atkCard    = this.pendingAttack.card;
    const attackerId = this.pendingAttack.attackerId;

    if (defCard.type === 'evade') {
      this.log(`✨ ${defender.name} usou Z-VANISH TELEPORT e esquivou do ataque!`, 'evade');
      if (this.onFx) this.onFx('cardClash', { atkCard, defCard, attackerKey: attackerId, defenderKey: defenderId, mode: 'evade' });
      if (typeof uiManager !== 'undefined' && uiManager) {
        uiManager.triggerActionBanner('Z-VANISH TELEPORT', 'act-evade', '瞬身');
      }
      if (typeof soundEngine !== 'undefined' && soundEngine) soundEngine.playZVanish();

    } else if ((defCard.isBeam || defCard.type === 'beam') && atkCard && (atkCard.isBeam || atkCard.type === 'beam')) {
      // BEAM CLASH: Jogador vs Boss!
      this.log(`🔥 DISPUTA DE BEAM! ${defender.name} vs ${this.boss.name}!`, 'info');
      if (this.onFx) this.onFx('beamClash', { attackerId, defenderId });
      if (typeof uiManager !== 'undefined' && uiManager) {
        uiManager.triggerActionBanner('DISPUTA DE BEAM!', 'act-attack', 'KAMEHAMEHA VS CHEFE');
      }
      this.startBeamClashLoop();
      return;

    } else if (defCard.type === 'counter') {
      const counterDmg = defCard.power || 30;
      this.boss.hp = Math.max(0, this.boss.hp - counterDmg);
      this.log(`⚡ ${defender.name} usou Z-COUNTER! Contra-atacou o chefe por ${counterDmg} de dano!`, 'evade');
      if (this.onFx) this.onFx('cardClash', { atkCard, defCard, attackerKey: attackerId, defenderKey: defenderId, mode: 'counter' });
      if (typeof uiManager !== 'undefined' && uiManager) {
        uiManager.triggerCardClashAnimation && uiManager.triggerCardClashAnimation(atkCard, defCard, 'counter');
      }

    } else if (defCard.type === 'defense' || defCard.type === 'block') {
      const blockAmount = defCard.block || Math.floor((atkCard?.power || this.pendingAttack.damage) * 0.5);
      const netDamage   = Math.max(0, this.pendingAttack.damage - blockAmount);
      defender.hp = Math.max(0, defender.hp - netDamage);
      defender.shields = Math.ceil(defender.hp / 50);
      this.log(`🛡️ ${defender.name} usou ${defCard.name} e bloqueou ${blockAmount} de dano! (Dano resultante: ${netDamage})`, 'evade');
      if (this.onFx) this.onFx('cardClash', { atkCard, defCard, attackerKey: attackerId, defenderKey: defenderId, mode: 'defense' });

    } else {
      const fallbackDmg = Math.floor(this.pendingAttack.damage * 0.5);
      defender.hp = Math.max(0, defender.hp - fallbackDmg);
      defender.shields = Math.ceil(defender.hp / 50);
      this.log(`🛡️ ${defender.name} reduziu o dano para ${fallbackDmg}!`, 'evade');
    }

    this._finishAttackResolution();
  }

  /* ── Ataque Sem Resposta ───────────────────────────────────────────── */

  resolveUnansweredAttack() {
    if (!this.pendingAttack) return;
    const { attackerId, targetId, card, damage } = this.pendingAttack;

    if (targetId === 'boss') {
      // Player atacou o boss sem reação
      if (card) {
        this._playAttackFX(card, attackerId, damage);
      }
      this.boss.hp = Math.max(0, this.boss.hp - damage);
      const attacker = this.players[attackerId];
      this.log(`${attacker?.name || attackerId} acertou ${card?.name} causando ${damage} de dano em ${this.boss.name}!`, 'damage');

    } else {
      // Boss atacou um player sem reação
      const target = this.players[targetId];
      if (target && card) {
        let dmg = damage;
        if (target.hp > 0) {
          const prevShields = target.shields;
          target.hp       = Math.max(0, target.hp - dmg);
          target.shields  = Math.ceil(target.hp / 50);
          this.log(`${this.boss.name} acertou ${card.name} causando ${dmg} de dano em ${target.name}!`, 'damage');
          // FX de ataque do boss
          if (this.onFx) this.onFx('punch', { card, attackerKey: 'boss', damage: dmg });
        }
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
      const attacker = this.players[attackerKey];
      this.onFx('kamehameha', { card, attackerKey, isGolden: attacker?.isAwakened, damage: dmg });
    } else if (card.type === 'ki_blast' || cardNameLower.includes('ki blast')) {
      this.onFx('kiBlast', { card, attackerKey, damage: dmg });
    } else {
      this.onFx('punch', { card, attackerKey, damage: dmg });
    }
  }

  /* ── Finalizar Resolução de Ataque ─────────────────────────────────── */

  _finishAttackResolution() {
    this._isBossActing = false; // Release boss phase guard
    const prevAttackerId = this.pendingAttack?.attackerId;
    this.pendingAttack = null;
    this.state = 'FREE_ACTION';

    this._checkBossEnrage();
    Object.values(this.players).forEach(p => this._checkAwaken(p));
    this._checkGameOver();

    if (!this.winner) {
      this._advanceTurn(prevAttackerId || this.activeFighterId);
    } else {
      this.notifyState();
    }
  }

  /* ── Resolver Carta de Suporte (Heal/Draw/Buff sem janela de reação) ── */

  _resolveSupportCard(playerId, card) {
    const actor = this.players[playerId];
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
    if (this.onFx) this.onFx('healSupport', { actorKey: playerId, card });

    this.notifyState();
    this._advanceTurn(playerId);
  }

  /* ── Passar Turno (botão explícito) ────────────────────────────── */

  passTurn(requestingPlayerId) {
    if (this.state !== 'FREE_ACTION') return;
    const pid = requestingPlayerId || this.activeFighterId;
    if (this.activeFighterId !== pid) return;
    this._advanceTurn(pid);
  }

  /* ── Avança para o próximo turno ───────────────────────────────────── */

  _advanceTurn(fromId) {
    if (this.winner) return;
    // Guard against re-entrant calls
    if (this._isAdvancingTurn) return;
    this._isAdvancingTurn = true;

    if (this.aiTurnTimeout) {
      clearTimeout(this.aiTurnTimeout);
      this.aiTurnTimeout = null;
    }

    // Avança na sequência pulando players mortos
    let attempts = 0;
    do {
      this.turnIndex = (this.turnIndex + 1) % this.turnSequence.length;
      this.activeFighterId = this.turnSequence[this.turnIndex];
      attempts++;
    } while (
      this.activeFighterId !== 'boss' &&
      this.players[this.activeFighterId]?.hp <= 0 &&
      attempts < this.turnSequence.length
    );

    // If no one is alive, bail
    if (attempts >= this.turnSequence.length && this.activeFighterId !== 'boss' && this.players[this.activeFighterId]?.hp <= 0) {
      this._isAdvancingTurn = false;
      return;
    }

    if (this.activeFighterId === 'boss') {
      // Fase do boss
      this.state = 'BOSS_PHASE';
      this.log(`⚠️ FASE DO CHEFE: ${this.boss.name} preparando contra-ataque!`, 'warn');
      if (this.onFx) this.onFx('bossPhase', { bossId: this.boss.bossId });
      this.notifyState();
      this._isAdvancingTurn = false;
      setTimeout(() => this.executeBossPhase(), 1500);
      return;
    }

    const actor = this.players[this.activeFighterId];
    if (actor && actor.hp > 0) {
      // Ganha +1 Ki e compra 1 carta ao receber turno (igual ao 1v1)
      actor.ki = Math.min(actor.maxKi, actor.ki + 1);
      this._drawCard(actor, 1);
      this.log(`🔄 Turno de ${actor.name} (+1 Ki, comprou 1 carta)`, 'info');
    }

    this.notifyState();
    this._isAdvancingTurn = false;

    // Executa AI para bots aliados
    if (this._isBotPlayer(this.activeFighterId) && !this.winner) {
      this.aiTurnTimeout = setTimeout(() => this.executeTeammateAiTurn(this.activeFighterId), 1200);
    }
  }

  /* ── Comprar Carta ─────────────────────────────────────────────────── */

  _drawCard(player, count = 1) {
    for (let c = 0; c < count; c++) {
      if (player.hand.length >= 7) break;
      if (!player.deck || player.deck.length === 0) {
        if (player.discard && player.discard.length > 0) {
          const rawDiscard = player.discard.map(x => typeof x === 'string' ? getCardById(x) : x).filter(Boolean);
          if (rawDiscard.length === 0) {
            player.deck = getStarterDeckForLeader(player.leaderKey || 'goku')
              .map(x => typeof x === 'string' ? getCardById(x) : x).filter(Boolean);
          } else {
            player.deck = [...rawDiscard];
          }
          player.discard = [];
          for (let i = player.deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [player.deck[i], player.deck[j]] = [player.deck[j], player.deck[i]];
          }
        } else {
          player.deck = getStarterDeckForLeader(player.leaderKey || 'goku')
            .map(x => typeof x === 'string' ? getCardById(x) : x).filter(Boolean);
        }
      }
      if (player.deck.length > 0) {
        const drawnCard = player.deck.shift();
        if (drawnCard) player.hand.push(drawnCard);
      }
    }
  }

  /* ── AI: Turno do Aliado Bot ───────────────────────────────────────── */

  executeTeammateAiTurn(playerId) {
    this.aiTurnTimeout = null;
    if (this.activeFighterId !== playerId) return;
    const actor = this.players[playerId];
    if (!actor || actor.hp <= 0 || this.winner) return;
    if (this.state !== 'FREE_ACTION') return;

    const hand      = actor.hand;
    const currentKi = actor.ki;
    const hpRatio   = actor.hp / actor.maxHp;

    const mainPhasePlayable = ['attack', 'ki_blast', 'support', 'tech', 'combo'];
    const affordable = hand
      .map((raw, index) => {
        const card = typeof raw === 'string' ? getCardById(raw) : raw;
        return card && card.cost <= currentKi && mainPhasePlayable.includes(card.type || 'attack') ? { card, index } : null;
      })
      .filter(Boolean);

    if (affordable.length === 0) {
      if (currentKi < actor.maxKi) {
        this.chargeKi(playerId);
      } else {
        this._advanceTurn(playerId);
      }
      return;
    }

    const scored = affordable.map(item => {
      const c = item.card;
      let score = 10;
      if (c.type === 'attack' || c.damage > 0 || c.isBeam) {
        score += c.power || c.damage || 40;
        if (c.isBeam || c.rarity === 'super-rare') score += 50;
        // Se o boss está com pouco HP, prioriza ataque
        if (this.boss.hp <= (c.power || 40) * 2) score += 200;
      }
      if (c.heal > 0 && hpRatio <= 0.5) score += 120;
      if (c.cost > 0 && (c.power || 0) > 0) score += ((c.power || 0) / c.cost) * 12;
      return { ...item, score };
    });
    scored.sort((a, b) => b.score - a.score);
    const best = scored[0];

    if (best.score < 40 && currentKi <= 5 && Math.random() > 0.25) {
      this.chargeKi(playerId);
      return;
    }

    this.playCard(playerId, best.index);
  }

  /* ── Fase do Boss ──────────────────────────────────────────────────── */

  executeBossPhase() {
    if (!this.boss || this.winner) return;
    // Guard against double execution
    if (this._isBossActing) return;
    this._isBossActing = true;

    const livingPlayers = Object.values(this.players).filter(p => p.hp > 0);
    if (livingPlayers.length === 0) {
      this._checkGameOver();
      return;
    }

    const isEnraged   = this.boss.isEnraged;
    const targetPlayer = livingPlayers[Math.floor(Math.random() * livingPlayers.length)];
    const dmg         = isEnraged ? Math.floor(this.boss.ultimateDamage * 0.9) : 60;

    const atkName = isEnraged ? this.boss.ultimateAttack : 'DISPARO DE ENERGIA MAX';

    // Boss "ataca": cria pendingAttack e abre reaction window para o player-alvo
    const bossCard = {
      id: 'boss_attack',
      name: atkName,
      type: 'attack',
      cost: 0,
      power: dmg,
      isBeam: isEnraged // boss enragido usa beam
    };

    this.pendingAttack = {
      attackerId: 'boss',
      targetId:   targetPlayer.id,
      card:       bossCard,
      damage:     dmg
    };
    this.state = 'ATTACK_PENDING';

    this.log(`🐉 ${this.boss.name} usa ${atkName}! Atacando ${targetPlayer.name}! (${dmg} de dano)`, 'damage');

    if (this.onFx) {
      this.onFx(isEnraged ? 'kamehameha' : 'punch', { card: bossCard, attackerKey: 'boss', damage: dmg });
    }

    this.notifyState();

    // Reaction window para o player alvo (3s para ele reagir)
    this.startReactionTimer(targetPlayer.id);
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
      const atkColor = this.players[attackerId]?.color || '#00f2fe';
      const defColor = this.boss?.color || '#ff0055';

      this.beamClashData.p1Progress = Math.max(0, this.beamClashData.p1Progress - 1.2);
      this.beamClashData.timer -= 0.1;

      if (this.onFx) this.onFx('beamClash', { p1Progress: this.beamClashData.p1Progress, p1Color: atkColor, p2Color: defColor });

      this.notifyState();

      if (this.beamClashData.p1Progress <= 0) {
        this.clearBeamClashLoop();
        this.resolveBeamClashWinner('boss');
      } else if (this.beamClashData.p1Progress >= 100) {
        this.clearBeamClashLoop();
        this.resolveBeamClashWinner(this.pendingAttack?.attackerId);
      } else if (this.beamClashData.timer <= 0) {
        this.clearBeamClashLoop();
        const winnerId = this.beamClashData.p1Progress >= 50
          ? this.pendingAttack?.attackerId
          : 'boss';
        this.resolveBeamClashWinner(winnerId);
      }
    }, 100);
  }

  mashBeamClash(fighterId) {
    if (this.state !== 'BEAM_CLASH' || !this.beamClashData || !this.pendingAttack) return;

    if (fighterId === this.pendingAttack.attackerId) {
      this.beamClashData.p1Progress = Math.min(100, this.beamClashData.p1Progress + 7);
    }

    const atkColor = this.players[this.pendingAttack.attackerId]?.color || '#00f2fe';
    if (this.onFx) this.onFx('beamClash', { p1Progress: this.beamClashData.p1Progress, p1Color: atkColor, p2Color: this.boss?.color || '#ff0055' });

    this.notifyState();

    if (this.beamClashData.p1Progress >= 100) {
      this.clearBeamClashLoop();
      this.resolveBeamClashWinner(fighterId);
    } else if (this.beamClashData.p1Progress <= 0) {
      this.clearBeamClashLoop();
      this.resolveBeamClashWinner('boss');
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

    const isBossWinner = (winnerId === 'boss');
    const beamDmg = 80;

    if (isBossWinner) {
      const target = this.players[this.pendingAttack.attackerId];
      if (target) {
        target.hp      = Math.max(0, target.hp - beamDmg);
        target.shields = Math.ceil(target.hp / 50);
        this.log(`🐉 ${this.boss.name} venceu a DISPUTA DE BEAM! Causou ${beamDmg} de dano em ${target.name}!`, 'damage');
      }
    } else {
      const winner = this.players[winnerId];
      this.boss.hp = Math.max(0, this.boss.hp - beamDmg);
      this.log(`💥 ${winner?.name || winnerId} venceu a DISPUTA DE BEAM! Causou ${beamDmg} de dano massivo em ${this.boss.name}!`, 'damage');
    }

    if (this.onFx) this.onFx('kamehameha', { attackerKey: winnerId, isGolden: true, damage: beamDmg });
    if (typeof uiManager !== 'undefined' && uiManager) {
      uiManager.triggerActionBanner('BEAM VENCIDA!', 'act-attack', isBossWinner ? `${this.boss.name} 💥` : `JOGADOR 💥`);
    }

    this._finishAttackResolution();
  }

  /* ── Boss Enraivecido ──────────────────────────────────────────────── */

  _checkBossEnrage() {
    if (!this.boss.isEnraged && (this.boss.hp / this.boss.maxHp) <= 0.5) {
      this.boss.isEnraged = true;
      this.log(`🔥 O CHEFE ${this.boss.name} ENTROU EM FÚRIA TOTAL (ENRAGED)!`, 'awaken');
      if (this.onFx) this.onFx('awaken', { color: this.boss.color, actorId: 'boss' });
      if (typeof soundEngine !== 'undefined' && soundEngine) soundEngine.playAwaken();
      if (typeof uiManager !== 'undefined' && uiManager) {
        uiManager.triggerActionBanner(`${this.boss.name} ENRAIVECEU!`, 'act-awaken', '⚠️ FÚRIA TOTAL');
      }
    }
  }

  /* ── Awaken dos Players ────────────────────────────────────────────── */

  _checkAwaken(actor) {
    if (!actor || actor.isAwakened) return;
    if (actor.hp <= actor.maxHp * 0.5) {
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

  /* ── Fim de Jogo ───────────────────────────────────────────────────── */

  _checkGameOver() {
    if (this.boss.hp <= 0) {
      this.winner = 'Team Z (Players)';
      this.state  = 'GAME_OVER';
      this.log(`🏆 RAID VENCIDA! O Chefe ${this.boss.name} foi derrotado!`, 'awaken');
      if (typeof soundEngine !== 'undefined' && soundEngine) soundEngine.playAwaken();
      if (typeof uiManager !== 'undefined' && uiManager) {
        uiManager.triggerActionBanner('RAID VENCIDA! 🏆', 'act-attack', `${this.boss.name} DERROTADO`);
        setTimeout(() => uiManager.showGameResult && uiManager.showGameResult(true), 1800);
      }
    } else {
      const allDead = Object.values(this.players).every(p => p.hp <= 0);
      if (allDead) {
        this.winner = 'Raid Boss';
        this.state  = 'GAME_OVER';
        this.log(`💀 DERROTA NA RAID! Todos os guerreiros foram derrotados...`, 'damage');
        if (typeof uiManager !== 'undefined' && uiManager) {
          uiManager.triggerActionBanner('DERROTA NA RAID...', 'act-charge', `${this.boss.name} VENCEU`);
          setTimeout(() => uiManager.showGameResult && uiManager.showGameResult(false), 1800);
        }
      }
    }
  }

  /* ── Helpers ───────────────────────────────────────────────────────── */

  _isBotPlayer(playerId) {
    return playerId !== 'p1' && !this.remotePlayerFighterIds.includes(playerId);
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
      mode:                   'raid',
      boss:                   this.boss,
      players:                this.players,
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
    this.boss                   = remoteState.boss;
    this.players                = remoteState.players;
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
    if (this.state !== 'BEAM_CLASH') this.clearBeamClashLoop();
    if (this.aiTurnTimeout) {
      clearTimeout(this.aiTurnTimeout);
      this.aiTurnTimeout = null;
    }
    if (this.visualReactionTimer) {
      clearInterval(this.visualReactionTimer);
      this.visualReactionTimer = null;
    }
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
