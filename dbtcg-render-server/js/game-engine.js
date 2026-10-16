/* ==========================================================================
   Dragon Ball Clash Action TCG — Game Engine Core Logic
   Real-Time 3s Reactions, Animated Beam Clash Tug-of-War, AI Turn Safety & RNG
   ========================================================================== */

import { LEADERS, getCardById, getStarterDeckForLeader } from './card-database.js';

export class GameEngine {
  checkGameOver() {
    if (this.isGameOverHandled) return true;
    if (!this.player || !this.opponent) return false;
    
    let winner = this.winner;

    if (!winner) {
      if (this.opponent.hp <= 0 && this.player.hp <= 0) {
        winner = 'player';
      } else if (this.opponent.hp <= 0) {
        winner = 'player';
      } else if (this.player.hp <= 0) {
        winner = 'opponent';
      }
    }

    if (winner) {
      this.state = 'GAME_OVER';
      this.winner = winner;
      this.isGameOverHandled = true;
      
      const isPlayerWinner = winner === 'player';
      this.log(`🔥 K.O.! ${isPlayerWinner ? 'VOCÊ VENCEU!' : 'VOCÊ FOI DERROTADO!'} 🔥`, 'info');
      
      if (typeof authManager !== 'undefined' && authManager) {
        authManager.recordMatchResult(isPlayerWinner, 25);
      }

      if (typeof uiManager !== 'undefined' && uiManager) {
        const bannerClass = isPlayerWinner ? 'act-attack' : 'act-charge';
        const bannerTitle = isPlayerWinner ? 'K.O.! VITÓRIA' : 'K.O.! DERROTA';
        const bannerSub = isPlayerWinner ? 'K.O. - YOU WIN' : 'K.O. - YOU LOSE';
        
        if (typeof soundEngine !== 'undefined' && soundEngine) {
          if (isPlayerWinner) soundEngine.playAwaken();
        }
        uiManager.triggerActionBanner(bannerTitle, bannerClass, bannerSub);
        
        setTimeout(() => {
          uiManager.showGameResult(isPlayerWinner);
        }, 1800);
      }
      return true;
    }
    return false;
  }

  constructor(renderCallback, fxCallback) {
    this.render = renderCallback || (() => {});
    this.fx = fxCallback || (() => {});
    this.onTimerTick = null;
    this.beamClashInterval = null;
    this.reset();
  }

  reset() {
    this.clearBeamClashLoop();
    this.clearReactionTimer();
    // Clear any pending AI turn timeout to prevent ghost AI actions
    if (this._aiTurnTimeout) {
      clearTimeout(this._aiTurnTimeout);
      this._aiTurnTimeout = null;
    }

    this.state = 'LOBBY'; // LOBBY, FREE_ACTION, ATTACK_PENDING, BEAM_CLASH, GAME_OVER
    this.initiative = 'player';
    this.winner = null;
    this.isGameOverHandled = false;
    this.isActionProcessing = false;
    this._aiTurnTimeout = null;
    this._isResolvingAttack = false; // Guard against double-resolution
    this.battleLogs = [];

    this.player = {
      name: 'Player',
      leader: { ...LEADERS.goku },
      hp: 300,
      maxHp: 300,
      shields: 6,
      ki: 3,
      isAwakened: false,
      isOpenGuard: false,
      nextAttackBuff: 0,
      hand: [],
      deck: [],
      discard: []
    };

    this.opponent = {
      name: 'Opponent',
      leader: { ...LEADERS.vegeta },
      hp: 300,
      maxHp: 300,
      shields: 6,
      ki: 3,
      isAwakened: false,
      isOpenGuard: false,
      nextAttackBuff: 0,
      hand: [],
      deck: [],
      discard: []
    };

    this.attackResolved = false;
    this.pendingAttack = null;
    this.beamClashData = null;
    this.reactionTimer = null;
    this.reactionSecondsLeft = 3.0;
    this.attackSafetyTimer = null;
    this.isAiMatch = true;
  }

  get beamClash() {
    return {
      active: this.state === 'BEAM_CLASH',
      playerClicks: this.beamClashData ? this.beamClashData.p1Progress : 50
    };
  }

  hasDefensiveResponse(targetKey = 'player') {
    const target = targetKey === 'player' ? this.player : this.opponent;
    if (!this.pendingAttack) return false;
    const atkCard = this.pendingAttack.card;

    return target.hand.some(card => {
      if (target.ki < card.cost) return false;
      if (card.type === 'evade' && target.isOpenGuard) return false;
      if (['defense', 'evade', 'counter'].includes(card.type)) return true;
      if (card.isBeam && atkCard && atkCard.isBeam) return true;
      return false;
    });
  }

  log(text, type = 'info') {
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    this.battleLogs.unshift({ timestamp, text, type });
    if (this.battleLogs.length > 50) this.battleLogs.pop();
    // NOTE: Do NOT call notifyState() here. Log entries are flushed
    // on the next explicit notifyState() call from the action that
    // produced the log. This breaks the recursive render loop that
    // caused HP/Ki to flicker and duplicate renders.
  }

  notifyState() {
    this.render(this);
  }

  secureShuffle(array) {
    if (!Array.isArray(array) || array.length === 0) return [];
    const copy = [...array];
    for (let i = copy.length - 1; i > 0; i--) {
      const cryptoBuf = new Uint32Array(1);
      window.crypto.getRandomValues(cryptoBuf);
      const j = cryptoBuf[0] % (i + 1);
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  // Deterministic shuffle for discard→deck refill so both clients get the same order
  deterministicShuffle(array) {
    if (!Array.isArray(array) || array.length === 0) return [];
    const copy = [...array];
    let seed = array.length;
    for (let i = copy.length - 1; i > 0; i--) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      const j = seed % (i + 1);
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  startMatch(playerLeaderKey = 'goku', opponentLeaderKey = 'vegeta', playerDeck = [], isAiMatch = true, remoteSetup = null) {
    this.reset();
    this.isAiMatch = isAiMatch;

    let pKey = (typeof playerLeaderKey === 'string' && LEADERS[playerLeaderKey]) ? playerLeaderKey : 'goku';
    let oKey = (typeof opponentLeaderKey === 'string' && LEADERS[opponentLeaderKey]) ? opponentLeaderKey : 'vegeta';

    this.player.leader = { ...LEADERS[pKey] };
    this.opponent.leader = { ...LEADERS[oKey] };

    this.player.maxHp = this.player.leader.maxHp || 300;
    this.player.hp = this.player.maxHp;
    this.player.ki = 3;
    this.player.shields = Math.ceil(this.player.hp / 50);

    this.opponent.maxHp = this.opponent.leader.maxHp || 300;
    this.opponent.hp = this.opponent.maxHp;
    this.opponent.ki = 3;
    this.opponent.shields = Math.ceil(this.opponent.hp / 50);

    if (this.player.leader.id === 'frieza') this.player.ki = 4;
    if (this.opponent.leader.id === 'frieza') this.opponent.ki = 4;

    const rawPlayerDeck = (Array.isArray(playerDeck) && playerDeck.length >= 5) 
      ? playerDeck 
      : getStarterDeckForLeader(pKey);
    const rawOpponentDeck = getStarterDeckForLeader(oKey);

    if (remoteSetup) {
      this.player.deck = [...remoteSetup.playerDeck];
      this.opponent.deck = [...remoteSetup.opponentDeck];
      this.initiative = remoteSetup.initiative; // For host, player=player. For guest, player=opponent (inverted by multiplayer-manager)
    } else {
      this.player.deck = this.secureShuffle(rawPlayerDeck);
      this.opponent.deck = this.secureShuffle(rawOpponentDeck);
      
      const cryptoBuf = new Uint32Array(1);
      window.crypto.getRandomValues(cryptoBuf);
      this.initiative = cryptoBuf[0] % 2 === 0 ? 'player' : 'opponent';
    }

    for (let i = 0; i < 5; i++) {
      this.drawCard(this.player);
      this.drawCard(this.opponent);
    }
    this.state = 'FREE_ACTION';
    
    this.log(`Batalha Iniciada! ${this.initiative === 'player' ? 'Sua' : 'Do Oponente'} Iniciativa!`, 'info');
    
    if (this.isAiMatch && this.initiative === 'opponent') {
      setTimeout(() => this.executeAiTurn(), 1000);
    }

    this.notifyState();
  }

  drawCard(target, count = 1) {
    if (this.state === 'GAME_OVER') return;
    for (let c = 0; c < count; c++) {
      if (target.hand.length >= 7) break;
      if (target.deck.length === 0) {
        if (target.discard.length === 0) break;
        target.deck = this.deterministicShuffle(target.discard);
        target.discard = [];
      }
      const cardId = target.deck.pop();
      const cardObj = cardId ? getCardById(cardId) : null;
      if (cardObj) {
        target.hand.push({ ...cardObj, instanceId: `${cardObj.id}_${Date.now()}_${Math.random().toString(36).substr(2,4)}` });
      }
    }
    this.notifyState();
  }

  chargeKi(actorKey) {
    if (this.state !== 'FREE_ACTION' || this.initiative !== actorKey || this.isActionProcessing) return;
    if (this.onLocalAction && actorKey === 'player' && !this.isAiMatch) {
      this.onLocalAction('chargeKi', {});
      return;
    }
    this._chargeKi(actorKey);
  }

  _chargeKi(actorKey) {
    if (this.state !== 'FREE_ACTION' || this.initiative !== actorKey) return;
    if (this.isActionProcessing) return;
    this.isActionProcessing = true;

    const actor = actorKey === 'player' ? this.player : this.opponent;
    if (actor.ki < 10) {
      actor.ki = Math.min(10, actor.ki + 2);
      this.fx('kiAura', { x: actorKey === 'player' ? 300 : 900, y: 500, color: actor.leader.color });
      this.log(`${actor.name} carregou Ki (+2 Ki, total ${actor.ki}).`, 'info');
    } else {
      this.log(`${actor.name} já está com Ki máximo (10/10 Ki).`, 'info');
    }
    this.isActionProcessing = false;
    this._passTurn(actorKey);
  }

  passTurn(actorKey) {
    if (this.isActionProcessing) return;
    if (this.state !== 'FREE_ACTION' || this.initiative !== actorKey) return;
    if (this.onLocalAction && actorKey === 'player' && !this.isAiMatch) {
      this.onLocalAction('passTurn', {});
      return;
    }
    this._passTurn(actorKey);
  }

  _passTurn(actorKey) {
    if (this.state !== 'FREE_ACTION') return;
    // Prevent re-entrant passTurn calls
    if (this._isPassingTurn) return;
    this._isPassingTurn = true;

    if (this._aiTurnTimeout) {
      clearTimeout(this._aiTurnTimeout);
      this._aiTurnTimeout = null;
    }
    // Clean up any lingering resolution flags from previous turn
    this._isResolvingAttack = false;
    this.attackResolved = false;

    this.initiative = actorKey === 'player' ? 'opponent' : 'player';
    const currentHolder = this[this.initiative];
    currentHolder.ki = Math.min(10, currentHolder.ki + 1);
    this.drawCard(currentHolder, 1);
    this.log(`Turno passado. Iniciativa agora é de ${currentHolder.name}.`, 'info');
    
    this.notifyState();
    this._isPassingTurn = false;

    if (this.isAiMatch && this.initiative === 'opponent' && !this.winner) {
      this._aiTurnTimeout = setTimeout(() => {
        this._aiTurnTimeout = null;
        if (this.state === 'FREE_ACTION' && this.initiative === 'opponent' && !this.winner) {
          this.executeAiTurn();
        }
      }, 1000);
    }
  }

  playCard(actorKey, handIndex) {
    if (this.isActionProcessing) {
      console.warn(`[GameEngine] Action ignored: Action lock is currently active.`);
      return;
    }

    // Thin client execution: broadcast intent FIRST
    if (this.onLocalAction && actorKey === 'player' && !this.isAiMatch) {
      const card = this.player.hand[handIndex];
      this.onLocalAction('playCard', { cardIndex: handIndex, cardId: card ? card.id : null });
      return; // Thin client: Wait for server response
    }
    this._playCard(actorKey, handIndex);
  }

  _playCard(actorKey, handIndex, remoteCardId) {
    if (this.isActionProcessing) return;
    if (this.state === 'GAME_OVER' || this.state === 'BEAM_CLASH' || this.state === 'LOBBY') return;

    const actor = actorKey === 'player' ? this.player : this.opponent;

    let actualIndex = handIndex;
    if (remoteCardId) {
      const foundIndex = actor.hand.findIndex(c => c.id === remoteCardId);
      if (foundIndex !== -1) actualIndex = foundIndex;
    }

    if (actualIndex < 0 || actualIndex >= actor.hand.length) return;
    const card = actor.hand[actualIndex];
    const cardType = card.type || 'attack';

    // ═══ PHASE & ROLE PRE-VALIDATION (ZERO SIDE EFFECTS IF REJECTED) ═══
    const currentState = this.state; // snapshot state before any mutation
    if (currentState === 'FREE_ACTION') {
      if (this.initiative !== actorKey) {
        this.log(`⚠️ Fora do seu turno! Aguarde a vez do oponente.`, 'warning');
        return;
      }
      const mainPhasePlayable = ['attack', 'ki_blast', 'support', 'tech', 'combo'];
      if (!mainPhasePlayable.includes(cardType)) {
        this.log(`⚠️ Cartas de defesa só podem ser jogadas em resposta a um ataque!`, 'warning');
        return;
      }
    } else if (currentState === 'ATTACK_PENDING' && this.pendingAttack) {
      if (this.pendingAttack.attackerKey === actorKey) {
        this.log(`⚠️ Você é o atacante nesta jogada! Aguarde a resposta do oponente.`, 'warning');
        return;
      }
      // Already resolved? reject
      if (this.attackResolved || this._isResolvingAttack) return;
      const reactionTypes = ['defense', 'evade', 'counter', 'block'];
      const isBeamCounter = card.isBeam && this.pendingAttack.card && this.pendingAttack.card.isBeam;
      if (!reactionTypes.includes(cardType) && !isBeamCounter) {
        this.log(`⚠️ Carta inválida para reação! Use Defesa, Esquiva, Counter ou Feixe de Ki.`, 'warning');
        return;
      }
    } else {
      return; // Reject all plays in other states
    }

    if (actor.ki < card.cost) {
      this.log(`⚠️ Ki insuficiente (${actor.ki}/${card.cost}) para jogar ${card.name}.`, 'warning');
      return;
    }

    // ═══ ACQUIRE ATOMIC LOCK & CONSUME CARD/KI ═══
    this.isActionProcessing = true;

    actor.ki -= card.cost;
    actor.hand.splice(actualIndex, 1);
    actor.discard.push(card.id);

    // Support & Heal Cards: Execute immediately without starting attack/reaction window
    if (cardType === 'support') {
      this.resolveSupportCard(actorKey, card);
      return;
    }

    if (currentState === 'FREE_ACTION') {
      this.pendingAttack = { attackerKey: actorKey, card };
      this.state = 'ATTACK_PENDING';
      this.attackResolved = false;
      this._isResolvingAttack = false;
      this.log(`${actor.name} jogou ${card.name}!`, 'damage');

      const cardNameLower = (card.name || '').toLowerCase();
      const isBeamAttack = card.isBeam || 
                           cardNameLower.includes('kamehameha') || 
                           cardNameLower.includes('flash') || 
                           cardNameLower.includes('beam') || 
                           cardNameLower.includes('genki') || 
                           cardNameLower.includes('masenko') || 
                           cardNameLower.includes('bang') || 
                           cardNameLower.includes('supernova') ||
                           cardNameLower.includes('galick');

      if (isBeamAttack) {
        this.fx('attackCharging', { card, attackerKey: actorKey });
      }

      // Release lock BEFORE starting timer so the defender (human or AI) can react
      this.isActionProcessing = false;
      this.startReactionTimer();
      this.notifyState();

      // Schedule AI reaction after a short delay
      if (this.isAiMatch && actorKey === 'player') {
        if (this._aiTurnTimeout) clearTimeout(this._aiTurnTimeout);
        this._aiTurnTimeout = setTimeout(() => {
          this._aiTurnTimeout = null;
          // Only react if the attack is still pending and unresolved
          if (this.state === 'ATTACK_PENDING' && this.pendingAttack && 
              this.pendingAttack.attackerKey === 'player' && !this.attackResolved) {
            this.executeAiTurn();
          }
        }, 600);
      }
      return;
    } else if (currentState === 'ATTACK_PENDING') {
      this.clearReactionTimer();
      // Cancel the AI reaction timeout if the human defender responded first
      if (this._aiTurnTimeout) {
        clearTimeout(this._aiTurnTimeout);
        this._aiTurnTimeout = null;
      }
      this.resolveReaction(actorKey, card);
      return;
    }

    this.isActionProcessing = false;
    this.notifyState();
  }

  resolveSupportCard(actorKey, card) {
    const actor = actorKey === 'player' ? this.player : this.opponent;
    this.log(`✨ ${actor.name} usou a carta de Suporte: ${card.name}!`, 'info');

    if (card.selfHpCost) {
      actor.hp = Math.max(1, actor.hp - card.selfHpCost);
      actor.shields = Math.ceil(actor.hp / 50);
      this.log(`🔴 ${actor.name} sacrificou ${card.selfHpCost} HP!`, 'damage');
    }

    if (card.healHp) {
      actor.hp = Math.min(actor.maxHp, actor.hp + card.healHp);
      actor.shields = Math.ceil(actor.hp / 50);
      this.log(`💚 ${actor.name} restaurou +${card.healHp} HP! (HP Atual: ${actor.hp}/${actor.maxHp})`, 'info');
    }

    if (card.restoreShield) {
      const prevShields = actor.shields;
      actor.shields = Math.min(8, Math.ceil(actor.hp / 50));
      if (actor.shields > prevShields) {
        this.log(`🛡️ ${actor.name} recuperou 1 Escudo de Vida!`, 'info');
      }
    }

    if (card.kiGain) {
      actor.ki = Math.min(10, actor.ki + card.kiGain);
      this.log(`⚡ ${actor.name} recebeu +${card.kiGain} Ki! (Ki Atual: ${actor.ki}/10)`, 'info');
    }

    if (card.drawCards) {
      this.drawCard(actor, card.drawCards);
      this.log(`🃏 ${actor.name} comprou ${card.drawCards} carta(s)!`, 'info');
    }

    if (card.buffAtk) {
      actor.nextAttackBuff = (actor.nextAttackBuff || 0) + card.buffAtk;
      this.log(`👑 Próximo ataque de ${actor.name} causará +${card.buffAtk} HP de dano bônus!`, 'info');
    }

    // Trigger visual FX for support/healing
    this.fx('healSupport', { actorKey, card });

    if (this.onLocalAction && !this.isAiMatch && actorKey === 'player') {
      this.onLocalAction('resolveSupport', {
        actorKey,
        cardId: card.id,
        hp: actor.hp,
        ki: actor.ki,
        shields: actor.shields
      });
    }

    // Support card finishes turn action, release lock and pass turn to opponent
    this.isActionProcessing = false;
    this.notifyState();
    if (this.state === 'FREE_ACTION') {
      this._passTurn(actorKey);
    }
  }

  startReactionTimer() {
    this.clearReactionTimer();
    this.reactionSecondsLeft = 3.0;
    const intervalMs = 100;

    // In online multiplayer, only the DEFENDER runs the 3s timer.
    // The attacker relies on the defender's broadcast (with a backup safety timer).
    const isOnline = !this.isAiMatch;
    const isAttacker = this.pendingAttack && this.pendingAttack.attackerKey === 'player';

    if (isOnline && isAttacker) {
      this.reactionSecondsLeft = 5.0;
      this.reactionTimer = setInterval(() => {
        this.reactionSecondsLeft -= 0.1;
        if (this.onTimerTick) this.onTimerTick(this.reactionSecondsLeft, 5.0);
        if (this.reactionSecondsLeft <= 0) {
          this.clearReactionTimer();
          this.resolveUnansweredAttack();
        }
      }, intervalMs);
      return;
    }

    this.reactionTimer = setInterval(() => {
      this.reactionSecondsLeft -= 0.1;
      if (this.onTimerTick) this.onTimerTick(this.reactionSecondsLeft, 3.0);
      if (this.reactionSecondsLeft <= 0) {
        this.clearReactionTimer();
        this.resolveUnansweredAttack();
      }
    }, intervalMs);
  }

  clearReactionTimer() {
    if (this.reactionTimer) {
      clearInterval(this.reactionTimer);
      this.reactionTimer = null;
    }
    if (this.attackSafetyTimer) {
      clearTimeout(this.attackSafetyTimer);
      this.attackSafetyTimer = null;
    }
  }

  resolveUnansweredAttack() {
    // ═══ TRIPLE GUARD: state + resolved flag + resolving mutex ═══
    if (this.state !== 'ATTACK_PENDING') return;
    if (!this.pendingAttack) return;
    if (this.attackResolved || this._isResolvingAttack) return;
    this._isResolvingAttack = true;
    this.attackResolved = true;
    this.isActionProcessing = true;

    // Cancel any pending AI reaction timeout
    if (this._aiTurnTimeout) {
      clearTimeout(this._aiTurnTimeout);
      this._aiTurnTimeout = null;
    }

    const { attackerKey, card } = this.pendingAttack;
    const attacker = attackerKey === 'player' ? this.player : this.opponent;
    const defender = attackerKey === 'player' ? this.opponent : this.player;

    let dmg = card.power || 20;
    if (attacker.nextAttackBuff) {
      dmg += attacker.nextAttackBuff;
      this.log(`👑 Bônus de Suporte aplicado ao ataque: +${attacker.nextAttackBuff} HP!`, 'info');
      attacker.nextAttackBuff = 0;
    }
    if (defender.isOpenGuard) {
      dmg = Math.floor(dmg * 1.5);
      defender.isOpenGuard = false;
    }

    const prevShields = defender.shields;
    defender.hp = Math.max(0, defender.hp - dmg);
    defender.shields = Math.ceil(defender.hp / 50);

    const gokuKiGain = defender.leader && defender.leader.id === 'goku' && defender.ki < 10;
    if (gokuKiGain) {
      defender.ki = Math.min(10, defender.ki + 1);
      this.log(`⚡ Passive Goku: +1 Ki por receber dano!`, 'info');
    }

    const gohanShieldBreak = attacker.leader && attacker.leader.id === 'gohan' && prevShields > defender.shields;
    if (gohanShieldBreak) {
      this.drawCard(attacker, 2);
      this.log(`💥 Passive Gohan: Escudo destruído! Comprou 2 cartas.`, 'info');
    }

    if (this.onLocalAction && !this.isAiMatch) {
      const passives = {};
      if (gokuKiGain) passives.gokuKiGain = true;
      if (gohanShieldBreak) passives.gohanShieldBreak = true;
      this.onLocalAction('resolveAttack', {
        attackerKey,
        defenderHp: defender.hp,
        defenderShields: defender.shields,
        damage: dmg,
        passives: Object.keys(passives).length > 0 ? passives : undefined
      });
    }

    this._playAttackFX(card, attackerKey, dmg);

    if (this.checkGameOver()) {
      this.isActionProcessing = false;
      this._isResolvingAttack = false;
      return;
    }

    // ═══ CLEAN TRANSITION: clear ALL attack state before next turn ═══
    this.pendingAttack = null;
    this.state = 'FREE_ACTION';
    this.isActionProcessing = false;
    this._isResolvingAttack = false;

    if (card.isCombo) {
      this.log(`🔗 COMBO! ${attacker.name} mantém a iniciativa!`, 'info');
      this.notifyState();
      if (this.isAiMatch && attackerKey === 'opponent' && !this.winner) {
        this._aiTurnTimeout = setTimeout(() => {
          this._aiTurnTimeout = null;
          if (this.state === 'FREE_ACTION' && this.initiative === 'opponent' && !this.winner) {
            this.executeAiTurn();
          }
        }, 800);
      }
    } else {
      this._passTurn(attackerKey);
    }
  }

  _playAttackFX(card, attackerKey, dmg) {
    if (!card) return;
    const attacker = attackerKey === 'player' ? this.player : this.opponent;
    const defender = attackerKey === 'player' ? this.opponent : this.player;
    const cardNameLower = (card.name || '').toLowerCase();
    const cardIdLower = (card.id || '').toLowerCase();

    if (cardIdLower.includes('genkidama') || cardNameLower.includes('genki') || cardNameLower.includes('spirit bomb')) {
      this.fx('genkidama', { card, attackerKey, damage: dmg });
    } else if (cardIdLower.includes('final_flash') || cardNameLower.includes('final flash')) {
      this.fx('finalFlash', { card, attackerKey, damage: dmg });
    } else if (cardIdLower.includes('death_beam') || cardNameLower.includes('death beam')) {
      this.fx('deathBeam', { card, attackerKey, damage: dmg });
    } else if (cardIdLower.includes('special_beam') || cardNameLower.includes('makankosappo') || cardNameLower.includes('special beam')) {
      this.fx('specialBeam', { card, attackerKey, damage: dmg });
    } else if (cardIdLower.includes('masenko') || cardNameLower.includes('masenko')) {
      this.fx('masenko', { card, attackerKey, damage: dmg });
    } else if (cardIdLower.includes('big_bang') || cardNameLower.includes('big bang')) {
      this.fx('bigBang', { card, attackerKey, damage: dmg });
    } else if (cardIdLower.includes('burning') || cardNameLower.includes('burning attack')) {
      this.fx('burningAttack', { card, attackerKey, damage: dmg });
    } else if (cardIdLower.includes('supernova') || cardNameLower.includes('supernova') || cardNameLower.includes('death ball')) {
      this.fx('supernova', { card, attackerKey, damage: dmg });
    } else if (cardIdLower.includes('kienzan') || cardNameLower.includes('kienzan') || cardNameLower.includes('destructo disc')) {
      this.fx('kienzan', { card, attackerKey, damage: dmg });
    } else if (cardIdLower.includes('kikoho') || cardNameLower.includes('kikoho') || cardNameLower.includes('tri-beam')) {
      this.fx('kikoho', { card, attackerKey, damage: dmg });
    } else if (cardIdLower.includes('dragon_fist') || cardNameLower.includes('dragon fist')) {
      this.fx('dragonFist', { card, attackerKey, damage: dmg });
    } else if (cardIdLower.includes('meteor') || cardNameLower.includes('meteor combination') || cardNameLower.includes('combo')) {
      this.fx('meteorCombination', { card, attackerKey, damage: dmg });
    } else if (cardIdLower.includes('spirit_sword') || cardNameLower.includes('spirit sword') || cardNameLower.includes('sword slash')) {
      this.fx('spiritSword', { card, attackerKey, damage: dmg });
    } else if (cardNameLower.includes('solar flare') || cardNameLower.includes('taiyoken')) {
      this.fx('solarFlare', { card, attackerKey });
    } else if (cardNameLower.includes('time skip')) {
      this.fx('timeSkip', { card, attackerKey });
    } else if (card.isBeam || cardNameLower.includes('kamehameha') || cardNameLower.includes('galick gun')) {
      this.fx('kamehameha', { card, attackerKey, isGolden: attacker.isAwakened, damage: dmg });
    } else if (card.type === 'ki_blast' || cardNameLower.includes('ki blast')) {
      this.fx('kiBlast', { card, attackerKey, damage: dmg });
    } else {
      this.fx('punch', { card, attackerKey, damage: dmg });
    }

    this.log(`${attacker.name} acertou ${card.name} causando ${dmg} de dano em ${defender.name}!`, 'damage');
    this.checkAwaken(defender);
  }

  applyResolvedAttack(data) {
    if (this.state !== 'ATTACK_PENDING' || !this.pendingAttack) return;
    this.clearReactionTimer();
    const atkKey = data.attackerKey;
    const defender = atkKey === 'player' ? this.player : this.opponent;
    defender.hp = data.defenderHp;
    defender.shields = data.defenderShields;

    if (!this.attackResolved && data.passives) {
      const attacker = atkKey === 'player' ? this.opponent : this.player;
      if (data.passives.gohanShieldBreak) {
        this.drawCard(attacker, 2);
      }
      if (data.passives.gokuKiGain && defender.ki < 10) {
        defender.ki = Math.min(10, defender.ki + 1);
      }
    }

    this.attackResolved = true;

    const card = this.pendingAttack ? this.pendingAttack.card : null;
    if (card && data.damage) {
      this._playAttackFX(card, atkKey, data.damage);
    }
    this.checkGameOver();
    if (this.state === 'GAME_OVER') return;

    this.pendingAttack = null;
    this.state = 'FREE_ACTION';

    const remoteAttackerKey = atkKey === 'player' ? 'opponent' : 'player';
    this._passTurn(remoteAttackerKey);

    this.notifyState();
  }

  resolveReaction(defenderKey, card) {
    // ═══ GUARD: Prevent double-resolution ═══
    if (this.state !== 'ATTACK_PENDING' || !this.pendingAttack || this.attackResolved) {
      this.isActionProcessing = false;
      return;
    }
    if (this._isResolvingAttack) return;
    this._isResolvingAttack = true;
    this.attackResolved = true;
    this.isActionProcessing = true;

    const { attackerKey, card: atkCard } = this.pendingAttack;
    const attacker = attackerKey === 'player' ? this.player : this.opponent;
    const defender = defenderKey === 'player' ? this.player : this.opponent;

    if (card.type === 'evade') {
      this.fx('cardClash', { atkCard, defCard: card, attackerKey, defenderKey, mode: 'evade' });
      this.log(`${defender.name} realizou Z-VANISH e esquivou do ataque de ${attacker.name}!`, 'evade');
      defender.isOpenGuard = true;
      if (defender.leader && defender.leader.id === 'trunks') {
        const extraDraw = defender.isAwakened ? 2 : 1;
        const kiRefund = defender.isAwakened ? 2 : 0;
        this.drawCard(defender, extraDraw);
        if (kiRefund > 0) defender.ki = Math.min(10, defender.ki + kiRefund);
        this.log(`🗡️ Passive Trunks: Z-Vanish comprou ${extraDraw} carta(s)!`, 'info');
      }
    } else if (card.type === 'counter') {
      this.fx('cardClash', { atkCard, defCard: card, attackerKey, defenderKey, mode: 'counter' });
      const counterDmg = Math.floor((card.power || 18) * 0.5);
      if (counterDmg > 0) {
        attacker.hp = Math.max(0, attacker.hp - counterDmg);
        attacker.shields = Math.ceil(attacker.hp / 50);
        this.log(`${defender.name} realizou Z-COUNTER! Contra-atacou com ${counterDmg} de dano!`, 'evade');
      } else {
        this.log(`${defender.name} realizou Z-COUNTER e bloqueou o ataque de ${attacker.name}!`, 'evade');
      }
      defender.isOpenGuard = false;
    } else if (card.type === 'defense' || card.type === 'block') {
      this.fx('cardClash', { atkCard, defCard: card, attackerKey, defenderKey, mode: 'defense' });
      let blockAmount = card.block || Math.floor((atkCard?.power || 20) * 0.5);
      if (defender.leader && defender.leader.id === 'piccolo') {
        blockAmount += 15;
      }
      const netDamage = Math.max(0, (atkCard?.power || 20) - blockAmount);
      defender.hp = Math.max(0, defender.hp - netDamage);
      defender.shields = Math.ceil(defender.hp / 50);
      this.log(`${defender.name} usou ${card.name} e bloqueou ${blockAmount} de dano! (Dano resultante: ${netDamage})`, 'evade');
    } else if (card.isBeam && atkCard && atkCard.isBeam) {
      // Beam Clash: save attackerKey before clearing pendingAttack
      this._beamClashOriginalAttacker = attackerKey;
      this.startBeamClashLoop();
      // NOTE: startBeamClashLoop sets state=BEAM_CLASH and clears pendingAttack.
      // All locks are released inside resolveBeamClashWinner.
      return;
    }

    if (this.checkGameOver()) {
      this.isActionProcessing = false;
      this._isResolvingAttack = false;
      return;
    }

    // ═══ CLEAN TRANSITION ═══
    this.pendingAttack = null;
    this.state = 'FREE_ACTION';
    this.isActionProcessing = false;
    this._isResolvingAttack = false;
    this.notifyState();
    this._passTurn(attackerKey);
  }

  startBeamClashLoop() {
    this.clearReactionTimer();
    // Release all attack-phase locks since we're entering a new sub-state
    this.isActionProcessing = false;
    this._isResolvingAttack = false;
    this.pendingAttack = null;
    this.state = 'BEAM_CLASH';
    this.beamClashData = { p1Progress: 50, timer: 6.0 };
    this.log(`🔥 DISPUTA DE BEAM KAMEHAMEHA! Pressione o botão rapidamente!`, 'info');
    this.notifyState();

    this.clearBeamClashLoop();
    this.beamClashInterval = setInterval(() => {
      if (this.state !== 'BEAM_CLASH' || !this.beamClashData) {
        this.clearBeamClashLoop();
        return;
      }

      if (this.isAiMatch) {
        const aiPush = 1.2 + (Math.random() * 1.8);
        this.beamClashData.p1Progress = Math.max(0, this.beamClashData.p1Progress - aiPush);
      } else {
        this.beamClashData.p1Progress = Math.max(0, this.beamClashData.p1Progress - 0.8);
      }

      this.beamClashData.timer -= 0.1;

      this.fx('beamClash', {
        p1Progress: this.beamClashData.p1Progress,
        p1Color: this.player.leader.color,
        p2Color: this.opponent.leader.color
      });

      if (this.beamClashData.p1Progress <= 0) {
        this.clearBeamClashLoop();
        this.resolveBeamClashWinner('opponent');
      } else if (this.beamClashData.p1Progress >= 100) {
        this.clearBeamClashLoop();
        this.resolveBeamClashWinner('player');
      } else if (this.beamClashData.timer <= 0) {
        this.clearBeamClashLoop();
        const winnerKey = this.beamClashData.p1Progress >= 50 ? 'player' : 'opponent';
        this.resolveBeamClashWinner(winnerKey);
      }
    }, 100);
  }

  getSyncState() {
    return {
      playerHp: this.player.hp,
      playerKi: this.player.ki,
      playerShields: this.player.shields,
      playerHandSize: this.player.hand.length,
      opponentHp: this.opponent.hp,
      opponentKi: this.opponent.ki,
      opponentShields: this.opponent.shields,
      opponentHandSize: this.opponent.hand.length,
      state: this.state,
      initiative: this.initiative
    };
  }

  applyFullSyncState(data) {
    if (!data || this.isAiMatch) return;
    
    // Check for phase transitions to trigger FX
    const oldState = this.state;
    
    this.state = data.state;
    this.initiative = data.initiative;
    this.pendingAttack = data.pendingAttack;
    this.beamClashData = data.beamClashData;
    this.reactionSecondsLeft = data.reactionSecondsLeft;

    this.player.hp = data.player.hp;
    this.player.maxHp = data.player.maxHp;
    this.player.ki = data.player.ki;
    this.player.shields = data.player.shields;
    this.player.hand = data.player.hand;
    this.player.discard = data.player.discard;
    if (data.player.leader) this.player.leader = data.player.leader;
    
    // We don't get the full deck array, just the count, to avoid peeking. 
    // We can fake it locally or just accept it (the UI only needs length usually)
    // Actually, server-engine sent the full deck. We should just assign it.
    if (data.player.deck) this.player.deck = data.player.deck;

    this.opponent.hp = data.opponent.hp;
    this.opponent.maxHp = data.opponent.maxHp;
    this.opponent.ki = data.opponent.ki;
    this.opponent.shields = data.opponent.shields;
    this.opponent.hand = data.opponent.hand;
    this.opponent.discard = data.opponent.discard;
    if (data.opponent.leader) this.opponent.leader = data.opponent.leader;
    if (data.opponent.deck) this.opponent.deck = data.opponent.deck;

    // Trigger animations for state changes
    if (oldState !== 'BEAM_CLASH' && this.state === 'BEAM_CLASH') {
       this.log(`🔥 DISPUTA DE BEAM KAMEHAMEHA! Pressione o botão rapidamente!`, 'info');
    }

    if (this.state === 'ATTACK_PENDING' && this.onTimerTick) {
      this.onTimerTick(this.reactionSecondsLeft, 3.0);
    }

    this.checkGameOver();
    this.notifyState();
  }

  applySyncState(data, remote) {
    if (remote) {
      this.player.hp = data.opponentHp;
      this.player.ki = data.opponentKi;
      this.player.shields = data.opponentShields;
      this.opponent.hp = data.playerHp;
      this.opponent.ki = data.playerKi;
      this.opponent.shields = data.playerShields;
      this.state = data.state;
      this.initiative = data.initiative === 'player' ? 'opponent' : 'player';
    } else {
      this.player.hp = data.playerHp;
      this.player.ki = data.playerKi;
      this.player.shields = data.playerShields;
      this.opponent.hp = data.opponentHp;
      this.opponent.ki = data.opponentKi;
      this.opponent.shields = data.opponentShields;
      this.state = data.state;
      this.initiative = data.initiative;
    }
    this.notifyState();
  }

  clearBeamClashLoop() {
    if (this.beamClashInterval) {
      clearInterval(this.beamClashInterval);
      this.beamClashInterval = null;
    }
  }

  mashBeamClash(actorKey = 'player') {
    if (this.onLocalAction && actorKey === 'player' && !this.isAiMatch) {
      this.onLocalAction('mashBeamClash', {});
      return; // Thin client: Wait for server response
    }
    this._mashBeamClash(actorKey);
  }

  _mashBeamClash(actorKey = 'player') {
    if (this.state !== 'BEAM_CLASH' || !this.beamClashData) return;

    if (actorKey === 'opponent') {
      this.beamClashData.p1Progress = Math.max(0, this.beamClashData.p1Progress - 7);
      if (this.beamClashData.p1Progress <= 0) {
        this.clearBeamClashLoop();
        this.resolveBeamClashWinner('opponent');
        return;
      }
      this.fx('beamClash', {
        p1Progress: this.beamClashData.p1Progress,
        p1Color: this.player.leader.color,
        p2Color: this.opponent.leader.color
      });
      return;
    }

    this.beamClashData.p1Progress = Math.min(100, this.beamClashData.p1Progress + 7);
    this.fx('beamClash', {
      p1Progress: this.beamClashData.p1Progress,
      p1Color: this.player.leader.color,
      p2Color: this.opponent.leader.color
    });

    if (this.beamClashData.p1Progress >= 100) {
      this.clearBeamClashLoop();
      this.resolveBeamClashWinner('player');
    }
  }

  resolveBeamClashWinner(winnerKey, loserHp) {
    this.isActionProcessing = true;
    this.clearBeamClashLoop();

    const winner = winnerKey === 'player' ? this.player : this.opponent;
    const loser = winnerKey === 'player' ? this.opponent : this.player;
    const BEAM_CLASH_DAMAGE = 60;

    if (loserHp !== undefined) {
      // Remote sync path: HP was already computed by the host
      loser.hp = Math.max(0, loserHp);
      loser.shields = Math.ceil(loser.hp / 50);
    } else {
      // Local resolution path
      loser.hp = Math.max(0, loser.hp - BEAM_CLASH_DAMAGE);
      loser.shields = Math.ceil(loser.hp / 50);
    }

    // Use saved attacker key from resolveReaction, fallback to initiative
    const originalAttacker = this._beamClashOriginalAttacker || this.initiative;
    this._beamClashOriginalAttacker = null;

    if (this.onLocalAction && !this.isAiMatch && loserHp === undefined) {
      const role = winnerKey === originalAttacker ? 'attacker' : 'defender';
      this.onLocalAction('beamClashEnd', { winner: role, loserHp: loser.hp });
    }

    this.fx('kamehameha', { attackerKey: winnerKey, isGolden: true });
    this.log(`💥 DISPUTA DE BEAM VENCIDA POR ${winner.name}! Causou ${BEAM_CLASH_DAMAGE} HP de dano massivo em ${loser.name}!`, 'damage');
    this.checkAwaken(loser);

    // ═══ CLEAN TRANSITION ═══
    this.beamClashData = null;
    this.state = 'FREE_ACTION';
    this.pendingAttack = null;
    this._isResolvingAttack = false;
    this.attackResolved = false;

    if (this.checkGameOver()) {
      this.isActionProcessing = false;
      return;
    }

    this.isActionProcessing = false;
    this.notifyState();
    this._passTurn(originalAttacker);
  }

  checkAwaken(fighterOrKey) {
    if (!fighterOrKey) return;
    const fighter = typeof fighterOrKey === 'string' 
      ? (fighterOrKey === 'player' ? this.player : this.opponent) 
      : fighterOrKey;
    if (!fighter || !fighter.leader) return;

    if (!fighter.isAwakened && fighter.hp <= (fighter.leader.awakenThresholdHp || 200)) {
      fighter.isAwakened = true;
      this.fx('awaken', { color: fighter.leader.color });
      this.log(`🔥 ${fighter.name} DESPERTOU A FORMA ${fighter.leader.awakenedName}!`, 'info');
    }
  }

  // ── OFFICIAL DRAGON BALL ARCADE TACTICAL AI ENGINE ─────────────────────────────
  executeAiTurn() {
    if (this.winner) return;
    if (this.isActionProcessing) return;
    if (this._isResolvingAttack) return;
    if (this.attackResolved) return; // Attack already handled, don't double-act
    if (this.state === 'BEAM_CLASH' || this.state === 'GAME_OVER' || this.state === 'LOBBY') return;

    if (this.state === 'FREE_ACTION' && this.initiative === 'opponent') {
      const opp = this.opponent;
      const ply = this.player;

      if (!opp || !opp.hand) return;

      const hand = opp.hand;
      const currentKi = opp.ki;
      const currentHp = opp.hp;
      const maxHp = opp.maxHp || 400;
      const hpRatio = currentHp / maxHp;

      // 1. Check Leader Awakening (Priority when HP <= 50%)
      if (!opp.isAwakened && hpRatio <= 0.5) {
        this.checkAwaken('opponent');
      }

      // 2. Find all affordable main-phase cards ONLY (Defense/Evade cards cannot be played in FREE_ACTION)
      const mainPhasePlayableTypes = ['attack', 'ki_blast', 'support', 'tech', 'combo'];
      const affordable = hand
        .map((card, index) => ({ card, index }))
        .filter(item => item.card && item.card.cost <= currentKi && mainPhasePlayableTypes.includes(item.card.type || 'attack'));

      // If no main-phase cards can be afforded: Charge Ki or Pass turn cleanly
      if (affordable.length === 0) {
        if (currentKi < 10) {
          this.chargeKi('opponent');
        } else {
          this.passTurn('opponent');
        }
        return;
      }

      // 3. Advanced Tactical Card Evaluation System (Tactical Scoring)
      const scored = affordable.map(item => {
        const c = item.card;
        let score = 10; // base score

        // A. Healing / Recovery (High priority when HP is low)
        if (c.heal > 0 || (c.type && c.type.includes('support')) || (c.name && (c.name.includes('Senzu') || c.name.includes('Cura')))) {
          if (hpRatio <= 0.35) score += 180;
          else if (hpRatio <= 0.65) score += 90;
          else score += 15;
        }

        // B. Power-Up / Ki Gain / Stat Boosts
        if (c.kiGain > 0 || c.powerUp > 0 || c.type === 'boost') {
          score += 65;
        }

        // C. Attack Cards (Strikes, Blasts, Super Specials)
        if (c.type === 'attack' || c.type === 'ki_blast' || c.power > 0 || c.isBeam) {
          const dmg = c.power || 20;
          score += dmg;

          // Target Player Weakness: Open Guard or Low HP
          if (ply.shields === 0 || ply.isOpenGuard) {
            score += 35; // Extra incentive to strike when open guard
          }

          // Lethal Finisher Potential
          if (ply.hp <= dmg + 20) {
            score += 250; // FINISHER COMBO!
          }

          // Iconic Specials / Beams
          if (c.isBeam || c.rarity === 'super-rare') {
            score += 50;
          }

          // Combo cards get bonus when AI has more Ki to chain
          if (c.isCombo && currentKi >= c.cost + 2) {
            score += 30; // Encourage combo chains when Ki allows
          }
        }

        // D. Efficiency Modifier (Damage output per Ki cost)
        if (c.cost > 0 && c.power > 0) {
          score += (c.power / c.cost) * 12;
        }

        return { ...item, score };
      });

      // Sort cards by highest tactical score
      scored.sort((a, b) => b.score - a.score);
      const best = scored[0];

      // Smart Ki Charging: If best available card has low tactical value and Ki <= 5, charge Ki to set up Kamehameha/Special next turn!
      if (best.score < 40 && currentKi <= 5 && Math.random() > 0.25) {
        this.chargeKi('opponent');
        return;
      }

      // Play highest scoring tactical card
      this.playCard('opponent', best.index);

    } else if (this.state === 'ATTACK_PENDING' && this.pendingAttack?.attackerKey === 'player') {
      const opp = this.opponent;
      const currentKi = opp.ki;

      // Smart Counter & Defense Selection
      const defCards = opp.hand
        .map((card, index) => ({ card, index }))
        .filter(item => item.card && (item.card.type === 'evade' || item.card.type === 'defense' || item.card.type === 'counter' || item.card.isBeam) && item.card.cost <= currentKi);

      if (defCards.length > 0) {
        // Prioritize Beam counter if incoming attack is a Beam
        const incomingIsBeam = this.pendingAttack?.card?.isBeam;
        let chosenDef = defCards[0];

        if (incomingIsBeam) {
          const beamCounter = defCards.find(item => item.card.isBeam);
          if (beamCounter) chosenDef = beamCounter;
        }

        this.playCard('opponent', chosenDef.index);
      } else {
        // AI has no reaction card available: let the timer resolve it naturally
        // Do nothing — the reaction timer will call resolveUnansweredAttack() when it expires
      }
    }
  }
}
