/* ==========================================================================
   Dragon Ball Clash Action TCG — Game Engine Core Logic
   Real-Time 3s Reactions, Animated Beam Clash Tug-of-War, AI Turn Safety & RNG
   ========================================================================== */

import { LEADERS, getCardById, getStarterDeckForLeader } from '../js/card-database.js';
import { getCardRule, isAttackAction, isImmediateTechnique, getEffectiveCardCost, getLeaderAttackBonus, getChargeAmount, getOpenGuardDurationMs, getBeamMashPower, getReactionSeconds, getDefenseBlockMultiplier, canUseReaction } from '../js/content-rules.js';
import crypto from 'crypto';
import { chooseDuelBotAction } from './bot-ai.js';

export class GameEngine {
  checkGameOver() {
      if (!this.player || !this.opponent) return false;
  
      let winner = this.winner || null;
      if (!winner) {
        if (this.opponent.hp <= 0 && this.player.hp <= 0) {
          winner = 'player';
        } else if (this.opponent.hp <= 0) {
          winner = 'player';
        } else if (this.player.hp <= 0) {
          winner = 'opponent';
        }
      }
  
      if (!winner) return false;
  
      this.winner = winner;
      this.state = 'GAME_OVER';
      this.clearReactionTimer();
      this.clearBeamClashLoop();
  
      if (!this.gameOverNotified) {
        this.gameOverNotified = true;
        const isPlayerWinner = winner === 'player';
        this.log(`🔥 K.O.! ${isPlayerWinner ? 'VOCÊ VENCEU!' : 'VOCÊ FOI DERROTADO!'} 🔥`, 'info');
  
        if (this.isAiMatch && typeof authManager !== 'undefined' && authManager.isLoggedIn && !authManager.user.isGuest) {
          authManager.recordMatchResult(isPlayerWinner, 25);
        }
  
        if (typeof uiManager !== 'undefined') {
          uiManager.triggerActionBanner(
            isPlayerWinner ? 'K.O.! VITÓRIA' : 'K.O.! DERROTA',
            isPlayerWinner ? 'act-attack' : 'act-charge',
            isPlayerWinner ? 'K.O. - YOU WIN' : 'K.O. - YOU LOSE'
          );
          setTimeout(() => uiManager.showGameResult(isPlayerWinner), 1800);
        }
      }
  
      this.notifyState();
      return true;
    }

  constructor(renderCallback, fxCallback) {
    this.render = renderCallback || (() => {});
    this.fxCallback = fxCallback || null;
    this.onFx = null;
    this.onTimerTick = null;
    this.beamClashInterval = null;
    this.reset();
  }

  fx(type, data) {
    if (typeof this.fxCallback === 'function') {
      this.fxCallback(type, data);
    }
    if (typeof this.onFx === 'function') {
      this.onFx(type, data);
    }
  }

  reset() {
      this.clearBeamClashLoop();
      this.clearReactionTimer();
      this.clearOpenGuardTimers();
  
      this.state = 'LOBBY';
      this.initiative = 'player';
      this.winner = null;
      this.gameOverNotified = false;
      this.battleLogs = [];
  
      const makeFighter = (name, leader) => ({
        name,
        leader: { ...leader },
        hp: 400,
        maxHp: 400,
        shields: 8,
        ki: 4,
        isAwakened: false,
        isOpenGuard: false,
        nextAttackBonus: 0,
        hand: [],
        deck: [],
        discard: []
      });
  
      this.player = makeFighter('Player', LEADERS.goku);
      this.opponent = makeFighter('Opponent', LEADERS.vegeta);
  
      this.attackResolved = false;
      this.pendingAttack = null;
      this.beamClashData = null;
      this.reactionTimer = null;
      this.reactionSecondsLeft = 3.0;
      this.reactionMaxSeconds = 3.0;
      this.attackSafetyTimer = null;
      this.isAiMatch = true;
      this.openGuardTimers = { player: null, opponent: null };
      this.lastMashAt = { player: 0, opponent: 0 };
    }

  get beamClash() {
    return {
      active: this.state === 'BEAM_CLASH',
      playerClicks: this.beamClashData ? this.beamClashData.p1Progress : 50
    };
  }

  clearOpenGuardTimers() {
      if (!this.openGuardTimers) return;
      for (const key of ['player', 'opponent']) {
        if (this.openGuardTimers[key]) {
          clearTimeout(this.openGuardTimers[key]);
          this.openGuardTimers[key] = null;
        }
      }
    }

  _clearOpenGuard(actorKey) {
      const actor = actorKey === 'player' ? this.player : this.opponent;
      if (!actor) return;
      actor.isOpenGuard = false;
  
      if (this.openGuardTimers?.[actorKey]) {
        clearTimeout(this.openGuardTimers[actorKey]);
        this.openGuardTimers[actorKey] = null;
      }
  
      this.notifyState();
    }

  _setOpenGuard(actorKey, durationMs = 3500) {
      const actor = actorKey === 'player' ? this.player : this.opponent;
      if (!actor) return;
  
      actor.isOpenGuard = true;
      if (!this.openGuardTimers) this.openGuardTimers = { player: null, opponent: null };
      if (this.openGuardTimers[actorKey]) clearTimeout(this.openGuardTimers[actorKey]);
  
      this.openGuardTimers[actorKey] = setTimeout(() => {
        if (this.state !== 'GAME_OVER') this._clearOpenGuard(actorKey);
      }, durationMs);
  
      this.notifyState();
    }

  getCardCost(actorKey, card) {
      const fighter = actorKey === 'player' ? this.player : this.opponent;
      return getEffectiveCardCost(fighter, card);
    }

  isReactionCardLegal(defenderKey, card, attackCard = this.pendingAttack?.card) {
      const defender = defenderKey === 'player' ? this.player : this.opponent;
      return canUseReaction(defender, attackCard, card);
    }

  _otherKey(key) {
      return key === 'player' ? 'opponent' : 'player';
    }

  _fighter(key) {
      return key === 'player' ? this.player : this.opponent;
    }

  _healFighter(key, amount) {
      const fighter = this._fighter(key);
      if (!fighter || amount <= 0) return 0;
      const before = fighter.hp;
      fighter.hp = Math.min(fighter.maxHp, fighter.hp + amount);
      fighter.shields = Math.ceil(fighter.hp / 50);
      return fighter.hp - before;
    }

  _applyDirectDamage(targetKey, amount, sourceKey = null) {
      const target = this._fighter(targetKey);
      if (!target) return { damage: 0, shieldBroken: false };
  
      const safeAmount = Math.max(0, Math.floor(Number(amount) || 0));
      const beforeHp = target.hp;
      const beforeShields = target.shields;
      target.hp = Math.max(0, target.hp - safeAmount);
      target.shields = Math.ceil(target.hp / 50);
      const actualDamage = beforeHp - target.hp;
  
      if (actualDamage > 0 && target.leader?.id === 'goku') {
        target.ki = Math.min(10, target.ki + 1);
        this.log('Passive Goku: +1 Ki por receber dano direto.', 'info');
      }
  
      this.checkAwaken(target);
  
      const shieldBroken = target.shields < beforeShields;
      if (shieldBroken && sourceKey) {
        const source = this._fighter(sourceKey);
        if (source?.leader?.id === 'gohan') {
          this.drawCard(source, 2);
          this.log('Passive Gohan: escudo quebrado, comprou 2 cartas.', 'info');
        }
      }
  
      return { damage: actualDamage, shieldBroken };
    }

  _runtimeAttackCard(actorKey, card, handBeforePlay) {
      const actor = this._fighter(actorKey);
      let bonus = getLeaderAttackBonus(actor, card, handBeforePlay);
  
      if (card.type === 'attack' && actor.nextAttackBonus > 0) {
        bonus += actor.nextAttackBonus;
        actor.nextAttackBonus = 0;
      }
  
      return {
        ...card,
        resolvedPower: Math.max(0, Number(card.power || 0) + bonus),
        runtimeCost: this.getCardCost(actorKey, card)
      };
    }

  _forceShieldBreakDamage(defender, normalDamage, attackCard) {
      if (!getCardRule(attackCard).breakShield || defender.shields <= 0) return normalDamage;
      const normalHp = Math.max(0, defender.hp - normalDamage);
      const shieldTargetHp = Math.max(0, (defender.shields - 1) * 50);
      const forcedHp = Math.min(normalHp, shieldTargetHp);
      return defender.hp - forcedHp;
    }

  _applyAttackPostHit(attackerKey, defenderKey, card, actualDamage) {
      if (actualDamage <= 0) return;
      const attacker = this._fighter(attackerKey);
      const defender = this._fighter(defenderKey);
      const rule = getCardRule(card);
  
      if (rule.drainKi) {
        const drained = Math.min(rule.drainKi, defender.ki);
        defender.ki -= drained;
        if (drained) this.log(`${card.name}: drenou ${drained} Ki.`, 'info');
      }
  
      if (rule.burnDefense) {
        const idx = defender.hand.findIndex(c => c?.type === 'defense');
        if (idx >= 0) {
          const [burned] = defender.hand.splice(idx, 1);
          defender.discard.push(burned.id);
          this.log(`${card.name}: ${defender.name} descartou ${burned.name}.`, 'info');
        }
      }
  
      // keep references used by logs/debuggers stable
      void attacker;
    }

  _finishAttack(attackerKey, card, defenderKey, forceDefenderInitiative = false) {
      this.pendingAttack = null;
      this.state = 'FREE_ACTION';
  
      if (getCardRule(card).retainInitiative && !forceDefenderInitiative) {
        this.initiative = attackerKey;
        this.log(`${card.name}: iniciativa mantida para continuar o combo.`, 'info');
        this.notifyState();
        if (this.isAiMatch && attackerKey === 'opponent') {
          setTimeout(() => this.executeAiTurn(), 350);
        }
        return;
      }
  
      if (forceDefenderInitiative) {
        this.initiative = defenderKey;
        this.notifyState();
        return;
      }
  
      this._passTurn(attackerKey);
    }

  _resolveTechnique(actorKey, card) {
      const actor = this._fighter(actorKey);
      const otherKey = this._otherKey(actorKey);
      const rule = getCardRule(card);
  
      if (rule.selfDamage) {
        this._applyDirectDamage(actorKey, rule.selfDamage, otherKey);
      }
      if (rule.heal) {
        const healed = this._healFighter(actorKey, rule.heal);
        if (healed) this.log(`${card.name}: recuperou ${healed} HP.`, 'info');
      }
      if (rule.kiGain) {
        const before = actor.ki;
        actor.ki = Math.min(10, actor.ki + rule.kiGain);
        const gained = actor.ki - before;
        if (gained) this.log(`${card.name}: +${gained} Ki.`, 'info');
      }
      if (rule.draw) this.drawCard(actor, rule.draw);
      if (rule.nextAttackBonus) {
        actor.nextAttackBonus = Math.max(actor.nextAttackBonus || 0, rule.nextAttackBonus);
        this.log(`${card.name}: proximo ataque recebe +${rule.nextAttackBonus} de dano.`, 'info');
      }
  
      this.checkAwaken(actor);
      if (this.checkGameOver()) return true;
  
      this.state = 'FREE_ACTION';
      this.pendingAttack = null;
      this._passTurn(actorKey);
      return true;
    }

  _applyDefenseExtras(defenderKey, attackerKey, defenseCard, attackCard) {
      const defender = this._fighter(defenderKey);
      const attacker = this._fighter(attackerKey);
      const rule = getCardRule(defenseCard);
  
      if (rule.kiGain) defender.ki = Math.min(10, defender.ki + rule.kiGain);
      if (rule.kiGainVsBeam && attackCard?.isBeam) defender.ki = Math.min(10, defender.ki + rule.kiGainVsBeam);
      if (rule.draw) this.drawCard(defender, rule.draw);
      if (rule.heal) this._healFighter(defenderKey, rule.heal);
  
      if (rule.stealKi) {
        const stolen = Math.min(rule.stealKi, attacker.ki);
        attacker.ki -= stolen;
        defender.ki = Math.min(10, defender.ki + stolen);
      }
  
      if (rule.reflect) {
        this._applyDirectDamage(attackerKey, rule.reflect, defenderKey);
      }
    }

  _applyEvadeExtras(defenderKey, evadeCard) {
      const defender = this._fighter(defenderKey);
      const rule = getCardRule(evadeCard);
      if (rule.kiGain) defender.ki = Math.min(10, defender.ki + rule.kiGain);
      if (rule.draw) this.drawCard(defender, rule.draw);
  
      if (defender.leader?.id === 'trunks') {
        const extraDraw = defender.isAwakened ? 2 : 1;
        this.drawCard(defender, extraDraw);
        if (defender.isAwakened) defender.ki = Math.min(10, defender.ki + 2);
        this.log(`Passive Trunks: Z-Vanish comprou ${extraDraw} carta(s)${defender.isAwakened ? ' e recuperou 2 Ki' : ''}.`, 'info');
      }
    }

  _applyCounterExtras(defenderKey, attackerKey, counterCard) {
      const defender = this._fighter(defenderKey);
      const rule = getCardRule(counterCard);
      if (rule.kiGain) defender.ki = Math.min(10, defender.ki + rule.kiGain);
      if (rule.counterDamage) this._applyDirectDamage(attackerKey, rule.counterDamage, defenderKey);
    }

  hasDefensiveResponse(targetKey = 'player') {
      const target = this._fighter(targetKey);
      if (!this.pendingAttack || !target) return false;
      const attackCard = this.pendingAttack.card;
  
      return target.hand.some(card => {
        if (!card || this.getCardCost(targetKey, card) > target.ki) return false;
        return this.isReactionCardLegal(targetKey, card, attackCard);
      });
    }

  log(text, type = 'info') {
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    this.battleLogs.unshift({ timestamp, text, type });
    if (this.battleLogs.length > 50) this.battleLogs.pop();
    this.notifyState();
  }

  notifyState() {
    this.render(this);
  }

  secureShuffle(array) {
    if (!Array.isArray(array) || array.length === 0) return [];
    const copy = [...array];
    for (let i = copy.length - 1; i > 0; i--) {
      const cryptoBuf = new Uint32Array(1);
      crypto.randomFillSync(cryptoBuf);
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

    this.player.maxHp = this.player.leader.maxHp || 400;
    this.player.hp = this.player.maxHp;
    this.player.shields = Math.ceil(this.player.hp / 50);

    this.opponent.maxHp = this.opponent.leader.maxHp || 400;
    this.opponent.hp = this.opponent.maxHp;
    this.opponent.shields = Math.ceil(this.opponent.hp / 50);

    if (this.player.leader.id === 'frieza') this.player.ki = 6;
    if (this.opponent.leader.id === 'frieza') this.opponent.ki = 6;

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
      crypto.randomFillSync(cryptoBuf);
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
    if (this.onLocalAction && actorKey === 'player' && !this.isAiMatch) {
      this.onLocalAction('chargeKi', {});
      this._chargeKi('player');
      return;
    }
    this._chargeKi(actorKey);
  }

  _chargeKi(actorKey) {
      if (!['player', 'opponent'].includes(actorKey)) return false;
      if (this.state !== 'FREE_ACTION' || this.initiative !== actorKey) return false;
  
      const actor = this._fighter(actorKey);
      const opponent = this._fighter(this._otherKey(actorKey));
      if (!actor || actor.ki >= 10) {
        if (actor) this.log(`${actor.name} ja esta com Ki maximo (10/10 Ki).`, 'info');
        return false;
      }
  
      const amount = getChargeAmount(actor, opponent);
      actor.ki = Math.min(10, actor.ki + amount);
      const durationMs = getOpenGuardDurationMs(actor, opponent);
      this._setOpenGuard(actorKey, durationMs);
  
      this.fx('kiAura', {
        attackerKey: actorKey,
        amount,
        openGuardMs: durationMs,
        x: actorKey === 'player' ? 300 : 900,
        y: 500,
        color: actor.leader.color
      });
      this.log(`${actor.name} carregou Ki (+${amount}, total ${actor.ki}) e abriu a guarda por ${(durationMs / 1000).toFixed(1)}s.`, 'info');
  
      this._passTurn(actorKey);
      return true;
    }

  passTurn(actorKey) {
    if (this.onLocalAction && actorKey === 'player' && !this.isAiMatch) {
      this.onLocalAction('passTurn', {});
      this._passTurn('player');
      return;
    }
    this._passTurn(actorKey);
  }

  _passTurn(actorKey) {
    if (this.state !== 'FREE_ACTION' || this.initiative !== actorKey) return;
    this.initiative = actorKey === 'player' ? 'opponent' : 'player';
    const currentHolder = this[this.initiative];
    currentHolder.ki = Math.min(10, currentHolder.ki + 1);
    this.drawCard(currentHolder, 1);
    this.log(`Turno passado. Iniciativa agora é de ${currentHolder.name}.`, 'info');
    
    this.notifyState();
    if (this.isAiMatch && this.initiative === 'opponent') {
      setTimeout(() => this.executeAiTurn(), 1000);
    }
  }

  playCard(actorKey, handIndex) {
    // Optimistic execution: broadcast intent FIRST, then execute locally
    if (this.onLocalAction && actorKey === 'player' && !this.isAiMatch) {
      const card = this.player.hand[handIndex];
      this.onLocalAction('playCard', { cardIndex: handIndex, cardId: card ? card.id : null });
      this._playCard('player', handIndex);
      return;
    }
    this._playCard(actorKey, handIndex);
  }

  _playCard(actorKey, handIndex, remoteCardId) {
      if (!['player', 'opponent'].includes(actorKey)) return false;
      if (this.state === 'GAME_OVER' || this.state === 'BEAM_CLASH') return false;
  
      const actor = this._fighter(actorKey);
      if (!actor) return false;
  
      let actualIndex = Number.isInteger(handIndex) ? handIndex : -1;
      if (remoteCardId) {
        const foundIndex = actor.hand.findIndex(c => c.id === remoteCardId);
        if (foundIndex !== -1) actualIndex = foundIndex;
      }
      if (actualIndex < 0 || actualIndex >= actor.hand.length) return false;
  
      const card = actor.hand[actualIndex];
      if (!card) return false;
      const effectiveCost = this.getCardCost(actorKey, card);
      if (actor.ki < effectiveCost) return false;
  
      let mode = null;
      if (this.state === 'FREE_ACTION') {
        if (this.initiative !== actorKey) return false;
        if (isImmediateTechnique(card)) mode = 'tech';
        else if (isAttackAction(card)) mode = 'attack';
        else return false;
      } else if (this.state === 'ATTACK_PENDING') {
        if (!this.pendingAttack) return false;
        const defenderKey = this._otherKey(this.pendingAttack.attackerKey);
        if (actorKey !== defenderKey) return false;
        if (!this.isReactionCardLegal(actorKey, card, this.pendingAttack.card)) return false;
        mode = 'reaction';
      } else {
        return false;
      }
  
      const handBeforePlay = [...actor.hand];
      actor.ki -= effectiveCost;
      actor.hand.splice(actualIndex, 1);
      actor.discard.push(card.id);
  
      if (mode === 'tech') {
        this.log(`${actor.name} usou ${card.name}.`, 'info');
        return this._resolveTechnique(actorKey, card);
      }
  
      if (mode === 'attack') {
        const runtimeCard = this._runtimeAttackCard(actorKey, card, handBeforePlay);
        this.pendingAttack = { attackerKey: actorKey, card: runtimeCard };
        this.state = 'ATTACK_PENDING';
        this.attackResolved = false;
        this.log(`${actor.name} jogou ${runtimeCard.name}!`, 'damage');
        if (runtimeCard.isBeam) this.fx('attackCharging', { card: runtimeCard, attackerKey: actorKey });
        this.startReactionTimer(getReactionSeconds(runtimeCard));
  
        if (this.isAiMatch && actorKey === 'player') setTimeout(() => this.executeAiTurn(), 250);
        this.notifyState();
        return true;
      }
  
      this.clearReactionTimer();
      let reactionCard = card;
      if (card.isBeam && isAttackAction(card)) {
        reactionCard = this._runtimeAttackCard(actorKey, card, handBeforePlay);
      }
      return this.resolveReaction(actorKey, reactionCard);
    }

  startReactionTimer(durationSec = 3.0) {
    this.clearReactionTimer();
    this.reactionMaxSeconds = Math.max(0.1, Number(durationSec) || 3.0);
    this.reactionSecondsLeft = this.reactionMaxSeconds;
    this.reactionDeadline = Date.now() + Math.round(this.reactionMaxSeconds * 1000);

    this.reactionTimer = setTimeout(() => {
      this.reactionSecondsLeft = 0;
      this.reactionDeadline = 0;
      this.reactionTimer = null;
      this.resolveUnansweredAttack();
    }, Math.round(this.reactionMaxSeconds * 1000));
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
      if (!this.pendingAttack || this.attackResolved || this.state !== 'ATTACK_PENDING') return false;
  
      this.attackResolved = true;
      const { attackerKey, card } = this.pendingAttack;
      const defenderKey = this._otherKey(attackerKey);
      const defender = this._fighter(defenderKey);
  
      let incoming = Math.max(0, Number(card.resolvedPower ?? card.power ?? 0));
      if (defender.isOpenGuard && incoming > 0) incoming = Math.floor(incoming * 1.5);
      incoming = this._forceShieldBreakDamage(defender, incoming, card);
  
      const result = this._applyDirectDamage(defenderKey, incoming, attackerKey);
      this._applyAttackPostHit(attackerKey, defenderKey, card, result.damage);
      this._playAttackFX(card, attackerKey, result.damage);
  
      if (this.checkGameOver()) return true;
      this._finishAttack(attackerKey, card, defenderKey, false);
      return true;
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
    const defender = data.attackerKey === 'player' ? this.player : this.opponent;
    defender.hp = data.defenderHp;
    defender.shields = data.defenderShields;

    if (!this.attackResolved && data.passives) {
      const attacker = data.attackerKey === 'player' ? this.opponent : this.player;
      if (data.passives.gohanShieldBreak) {
        this.drawCard(attacker, 2);
      }
      if (data.passives.gokuKiGain && defender.ki < 10) {
        defender.ki = Math.min(10, defender.ki + 1);
      }
    }

    this.attackResolved = true;
    this.pendingAttack = null;
    this.state = 'FREE_ACTION';

    const remoteAttackerKey = data.attackerKey === 'player' ? 'opponent' : 'player';
    this._passTurn(remoteAttackerKey);

    this.notifyState();
  }

  resolveReaction(defenderKey, card) {
      if (!this.pendingAttack || this.state !== 'ATTACK_PENDING') return false;
  
      const { attackerKey, card: attackCard } = this.pendingAttack;
      const expectedDefenderKey = this._otherKey(attackerKey);
      if (defenderKey !== expectedDefenderKey) return false;
      if (!this.isReactionCardLegal(defenderKey, card, attackCard)) return false;
  
      const attacker = this._fighter(attackerKey);
      const defender = this._fighter(defenderKey);
  
      if (card.isBeam && attackCard.isBeam && isAttackAction(card)) {
        this.startBeamClashLoop(card);
        return true;
      }
  
      if (card.type === 'evade') {
        this.fx('cardClash', { atkCard: attackCard, defCard: card, attackerKey, defenderKey, mode: 'evade' });
        this.log(`${defender.name} esquivou de ${attackCard.name} com ${card.name}.`, 'evade');
        this._clearOpenGuard(defenderKey);
        this._applyEvadeExtras(defenderKey, card);
  
        this.pendingAttack = null;
        this.state = 'FREE_ACTION';
        this.initiative = defenderKey;
        this.notifyState();
        if (this.isAiMatch && defenderKey === 'opponent') setTimeout(() => this.executeAiTurn(), 350);
        return true;
      }
  
      if (card.type === 'counter') {
        this.fx('cardClash', { atkCard: attackCard, defCard: card, attackerKey, defenderKey, mode: 'counter' });
        this.log(`${defender.name} contra-atacou com ${card.name}.`, 'evade');
        this._clearOpenGuard(defenderKey);
        this._applyCounterExtras(defenderKey, attackerKey, card);
  
        this.pendingAttack = null;
        if (this.checkGameOver()) return true;
        this.state = 'FREE_ACTION';
        this.initiative = defenderKey;
        this.notifyState();
        if (this.isAiMatch && defenderKey === 'opponent') setTimeout(() => this.executeAiTurn(), 350);
        return true;
      }
  
      if (card.type === 'defense') {
        this.fx('cardClash', { atkCard: attackCard, defCard: card, attackerKey, defenderKey, mode: 'defense' });
  
        let incoming = Math.max(0, Number(attackCard.resolvedPower ?? attackCard.power ?? 0));
        if (defender.isOpenGuard && incoming > 0) incoming = Math.floor(incoming * 1.5);
  
        let blockAmount = Math.max(0, Number(card.block || 0));
        if (defender.leader?.id === 'piccolo') blockAmount += 15;
        blockAmount = Math.floor(blockAmount * getDefenseBlockMultiplier(attacker, attackCard));
  
        let netDamage = Math.max(0, incoming - blockAmount);
        netDamage = this._forceShieldBreakDamage(defender, netDamage, attackCard);
        const result = this._applyDirectDamage(defenderKey, netDamage, attackerKey);
  
        this._applyAttackPostHit(attackerKey, defenderKey, attackCard, result.damage);
        this._applyDefenseExtras(defenderKey, attackerKey, card, attackCard);
        this.log(`${defender.name} usou ${card.name}: bloqueio ${blockAmount}, dano ${result.damage}.`, 'evade');
  
        if (this.checkGameOver()) return true;
        const forceDefenderInitiative = !!getCardRule(card).gainInitiative;
        this._finishAttack(attackerKey, attackCard, defenderKey, forceDefenderInitiative);
        return true;
      }
  
      return false;
    }

  startBeamClashLoop(defenderCard = null) {
      if (!this.pendingAttack || !defenderCard) return false;
  
      const attackerKey = this.pendingAttack.attackerKey;
      const defenderKey = this._otherKey(attackerKey);
      const attackerPower = Math.max(0, Number(this.pendingAttack.card.resolvedPower ?? this.pendingAttack.card.power ?? 0));
      const defenderPower = Math.max(0, Number(defenderCard.resolvedPower ?? defenderCard.power ?? 0));
  
      this.state = 'BEAM_CLASH';
      this.beamClashData = {
        p1Progress: 50,
        timer: 6.0,
        attackerKey,
        defenderKey,
        attackerCardId: this.pendingAttack.card.id,
        defenderCardId: defenderCard.id,
        playerPower: attackerKey === 'player' ? attackerPower : defenderPower,
        opponentPower: attackerKey === 'opponent' ? attackerPower : defenderPower
      };
      this.lastMashAt = { player: 0, opponent: 0 };
      this.log('DISPUTA DE BEAM iniciada.', 'info');
  
      this.clearBeamClashLoop();
      this.beamClashInterval = setInterval(() => {
        if (this.state !== 'BEAM_CLASH' || !this.beamClashData) {
          this.clearBeamClashLoop();
          return;
        }
        this.beamClashData.timer = Math.max(0, this.beamClashData.timer - 0.1);
        this.notifyState();

        if (
          this.isAiMatch &&
          this.state === 'BEAM_CLASH' &&
          Date.now() - (this.lastMashAt?.opponent || 0) >= 180
        ) {
          this._mashBeamClash('opponent');
        }
  
        if (this.beamClashData.p1Progress <= 0) this.resolveBeamClashWinner('opponent');
        else if (this.beamClashData.p1Progress >= 100) this.resolveBeamClashWinner('player');
        else if (this.beamClashData.timer <= 0) {
          this.resolveBeamClashWinner(this.beamClashData.p1Progress >= 50 ? 'player' : 'opponent');
        }
      }, 100);
      return true;
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

  getFullSyncState(viewerKey = 'player') {
      const hideHand = size => Array.from({ length: size }, (_, index) => ({ id: `__hidden_${index}`, hidden: true }));
      const pack = (fighter, reveal) => ({
        name: fighter.name,
        hp: fighter.hp,
        maxHp: fighter.maxHp,
        ki: fighter.ki,
        shields: fighter.shields,
        isAwakened: fighter.isAwakened,
        isOpenGuard: fighter.isOpenGuard,
        nextAttackBonus: fighter.nextAttackBonus || 0,
        hand: reveal ? fighter.hand : hideHand(fighter.hand.length),
        deckCount: fighter.deck.length,
        discard: fighter.discard,
        leader: fighter.leader
      });
  
      return {
        state: this.state,
        initiative: this.initiative,
        winner: this.winner,
        pendingAttack: this.pendingAttack,
        beamClashData: this.beamClashData,
        reactionSecondsLeft: this.reactionSecondsLeft,
        reactionMaxSeconds: this.reactionMaxSeconds,
      reactionDeadline: this.reactionDeadline || 0,
        player: pack(this.player, viewerKey === 'player'),
        opponent: pack(this.opponent, viewerKey === 'opponent')
      };
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
      this._mashBeamClash('player');
      return;
    }
    this._mashBeamClash(actorKey);
  }

  _mashBeamClash(actorKey = 'player') {
      if (this.state !== 'BEAM_CLASH' || !this.beamClashData) return false;
      if (!['player', 'opponent'].includes(actorKey)) return false;
  
      const now = Date.now();
      if (!this.lastMashAt) this.lastMashAt = { player: 0, opponent: 0 };
      if (now - (this.lastMashAt[actorKey] || 0) < 60) return false;
      this.lastMashAt[actorKey] = now;
  
      const fighter = this._fighter(actorKey);
      const mash = getBeamMashPower(fighter);
      const delta = actorKey === 'player' ? mash : -mash;
      this.beamClashData.p1Progress = Math.max(0, Math.min(100, this.beamClashData.p1Progress + delta));
  
      this.fx('beamClash', {
        p1Progress: this.beamClashData.p1Progress,
        p1Color: this.player.leader.color,
        p2Color: this.opponent.leader.color
      });
      this.notifyState();
  
      if (this.beamClashData.p1Progress >= 100) this.resolveBeamClashWinner('player');
      else if (this.beamClashData.p1Progress <= 0) this.resolveBeamClashWinner('opponent');
      return true;
    }

  resolveBeamClashWinner(winnerKey) {
      if (!['player', 'opponent'].includes(winnerKey) || !this.beamClashData) return false;
  
      const data = { ...this.beamClashData };
      const originalAttacker = data.attackerKey;
      const loserKey = this._otherKey(winnerKey);
      const winner = this._fighter(winnerKey);
      const damage = winnerKey === 'player' ? data.playerPower : data.opponentPower;
  
      this.clearBeamClashLoop();
      this.beamClashData = null;
      this.pendingAttack = null;
  
      const result = this._applyDirectDamage(loserKey, damage, winnerKey);
      this.fx('kamehameha', { attackerKey: winnerKey, isGolden: true, damage: result.damage });
      this.log(`DISPUTA DE BEAM vencida por ${winner.name}: ${result.damage} de dano.`, 'damage');
  
      if (this.checkGameOver()) return true;
      this.state = 'FREE_ACTION';
      this._passTurn(originalAttacker);
      return true;
    }

  checkAwaken(fighter) {
      if (!fighter || fighter.isAwakened) return false;
      if (fighter.hp > (fighter.leader.awakenThresholdHp || 200)) return false;
  
      fighter.isAwakened = true;
      const key = fighter === this.player ? 'player' : 'opponent';
  
      if (fighter.leader?.id === 'piccolo') {
        this._healFighter(key, 50);
        this.log('Passive Piccolo: restaurou 50 HP ao despertar.', 'info');
      }
  
      this.fx('awaken', { attackerKey: key, color: fighter.leader.color });
      this.log(`${fighter.name} DESPERTOU ${fighter.leader.awakenedName}!`, 'info');
      return true;
    }

  // ── AI TURN EXECUTION WITH FAILSAFE PASS ─────────────────────────────
  executeAiTurn() {
      const decision = chooseDuelBotAction(this, 'opponent');

      if (!decision) {
        if (this.state === 'ATTACK_PENDING' && this.pendingAttack?.attackerKey === 'player') {
          setTimeout(() => {
            if (this.state === 'ATTACK_PENDING' && this.pendingAttack?.attackerKey === 'player') {
              this.clearReactionTimer();
              this.resolveUnansweredAttack();
            }
          }, 850);
        }
        return;
      }

      switch (decision.action) {
        case 'playCard':
          this._playCard('opponent', decision.cardIndex, decision.cardId);
          break;
        case 'chargeKi':
          this._chargeKi('opponent');
          break;
        case 'passTurn':
          this._passTurn('opponent');
          break;
        case 'mashBeamClash':
          this._mashBeamClash('opponent');
          break;
        default:
          break;
      }
    }
}
