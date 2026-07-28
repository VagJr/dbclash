/* ==========================================================================
   Dragon Ball Clash Action TCG — Game Engine Core Logic
   Real-Time 3s Reactions, Animated Beam Clash Tug-of-War, AI Turn Safety & RNG
   ========================================================================== */

import { LEADERS, getCardById, getStarterDeckForLeader } from './card-database.js';

export class GameEngine {
  checkGameOver() {
    if (this.state === 'GAME_OVER') return true;
    if (!this.player || !this.opponent) return false;
    
    let winner = null;
    let loser = null;

    if (this.opponent.hp <= 0 && this.player.hp <= 0) {
      // Draw (tiebreaker goes to P1 for now)
      winner = 'player';
      loser = 'opponent';
    } else if (this.opponent.hp <= 0) {
      winner = 'player';
      loser = 'opponent';
    } else if (this.player.hp <= 0) {
      winner = 'opponent';
      loser = 'player';
    }

    if (winner) {
      this.state = 'GAME_OVER';
      this.log(`🔥 K.O.! ${winner === 'player' ? 'VOCÊ VENCEU!' : 'VOCÊ FOI DERROTADO!'} 🔥`, 'info');
      
      const isPlayerWinner = winner === 'player';
      
      if (typeof authManager !== 'undefined' && authManager.isLoggedIn && !authManager.user.isGuest) {
        authManager.recordMatchResult(isPlayerWinner, 25);
      }

      if (typeof uiManager !== 'undefined') {
        const bannerClass = isPlayerWinner ? 'act-attack' : 'act-charge';
        const bannerTitle = isPlayerWinner ? 'K.O.! VITÓRIA' : 'K.O.! DERROTA';
        const bannerSub = isPlayerWinner ? 'K.O. - YOU WIN' : 'K.O. - YOU LOSE';
        
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

    this.state = 'LOBBY'; // LOBBY, FREE_ACTION, ATTACK_PENDING, BEAM_CLASH, GAME_OVER
    this.initiative = 'player';
    this.winner = null;
    this.battleLogs = [];

    this.player = {
      name: 'Player',
      leader: { ...LEADERS.goku },
      hp: 400,
      maxHp: 400,
      shields: 8,
      ki: 4,
      isAwakened: false,
      isOpenGuard: false,
      hand: [],
      deck: [],
      discard: []
    };

    this.opponent = {
      name: 'Opponent',
      leader: { ...LEADERS.vegeta },
      hp: 400,
      maxHp: 400,
      shields: 8,
      ki: 4,
      isAwakened: false,
      isOpenGuard: false,
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

    this.player.maxHp = this.player.leader.maxHp || 400;
    this.player.hp = this.player.maxHp;
    this.player.shields = Math.ceil(this.player.hp / 50);

    this.opponent.maxHp = this.opponent.leader.maxHp || 400;
    this.opponent.hp = this.opponent.maxHp;
    this.opponent.shields = Math.ceil(this.opponent.hp / 50);

    if (this.player.leader.id === 'frieza') this.player.ki = 5;
    if (this.opponent.leader.id === 'frieza') this.opponent.ki = 5;

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
    if (this.onLocalAction && actorKey === 'player' && !this.isAiMatch) {
      this.onLocalAction('chargeKi', {});
      return; // Thin client: Wait for server response
    }
    this._chargeKi(actorKey);
  }

  _chargeKi(actorKey) {
    const actor = actorKey === 'player' ? this.player : this.opponent;
    if (actor.ki < 10) {
      actor.ki = Math.min(10, actor.ki + 2);
      this.fx('kiAura', { x: actorKey === 'player' ? 300 : 900, y: 500, color: actor.leader.color });
      this.log(`${actor.name} carregou Ki (+2 Ki, total ${actor.ki}).`, 'info');
    } else {
      this.log(`${actor.name} já está com Ki máximo (10/10 Ki).`, 'info');
    }
    this.notifyState();
    if (this.state === 'FREE_ACTION' && this.initiative === actorKey) {
      this._passTurn(actorKey);
    }
  }

  passTurn(actorKey) {
    if (this.onLocalAction && actorKey === 'player' && !this.isAiMatch) {
      this.onLocalAction('passTurn', {});
      return; // Thin client: Wait for server response
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
    // Thin client execution: broadcast intent FIRST
    if (this.onLocalAction && actorKey === 'player' && !this.isAiMatch) {
      const card = this.player.hand[handIndex];
      this.onLocalAction('playCard', { cardIndex: handIndex, cardId: card ? card.id : null });
      return; // Thin client: Wait for server response
    }
    this._playCard(actorKey, handIndex);
  }

  _playCard(actorKey, handIndex, remoteCardId) {
    const actor = actorKey === 'player' ? this.player : this.opponent;

    let actualIndex = handIndex;
    if (remoteCardId) {
      const foundIndex = actor.hand.findIndex(c => c.id === remoteCardId);
      if (foundIndex !== -1) actualIndex = foundIndex;
    }

    if (actualIndex < 0 || actualIndex >= actor.hand.length) return;
    const card = actor.hand[actualIndex];

    if (actor.ki < card.cost) return;

    actor.ki -= card.cost;
    actor.hand.splice(actualIndex, 1);
    actor.discard.push(card.id);

    if (this.state === 'FREE_ACTION' && this.initiative === actorKey) {
      if (card.type === 'attack' || card.type === 'tech') {
        this.pendingAttack = { attackerKey: actorKey, card };
        this.state = 'ATTACK_PENDING';
        this.attackResolved = false;
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

        this.startReactionTimer();
      }
    } else if (this.state === 'ATTACK_PENDING' && this.pendingAttack) {
      this.clearReactionTimer();
      this.resolveReaction(actorKey, card);
    }
    this.notifyState();
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
    if (!this.pendingAttack || this.attackResolved) return;
    this.attackResolved = true;
    const { attackerKey, card } = this.pendingAttack;
    const attacker = attackerKey === 'player' ? this.player : this.opponent;
    const defender = attackerKey === 'player' ? this.opponent : this.player;

    let dmg = card.power || 20;
    if (defender.isOpenGuard) dmg = Math.floor(dmg * 1.5);

    const prevShields = defender.shields;
    defender.hp = Math.max(0, defender.hp - dmg);
    defender.shields = Math.ceil(defender.hp / 50);
    this.checkGameOver();

    this.notifyState();

    // Leader Passive: Goku gains +1 Ki on taking direct damage
    const gokuKiGain = defender.leader && defender.leader.id === 'goku' && defender.ki < 10;
    if (gokuKiGain) {
      defender.ki = Math.min(10, defender.ki + 1);
      this.log(`⚡ Passive Goku: +1 Ki por receber dano!`, 'info');
    }

    // Leader Passive: Gohan draws 2 cards on Shield Break
    const gohanShieldBreak = attacker.leader && attacker.leader.id === 'gohan' && prevShields > defender.shields;
    if (gohanShieldBreak) {
      this.drawCard(attacker, 2);
      this.log(`💥 Passive Gohan: Escudo destruído! Comprou 2 cartas.`, 'info');
    }

    // Broadcast result for remote sync (absolute HP values + passives)
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

    if (defender.hp <= 0) {
      this.state = 'GAME_OVER';
      this.winner = attackerKey;
      this.log(`K.O.! ${attacker.name} venceu a batalha!`, 'info');
      return;
    }

    this.pendingAttack = null;
    this.state = 'FREE_ACTION';
    this._passTurn(attackerKey);
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
    const { attackerKey, card: atkCard } = this.pendingAttack || {};
    const attacker = attackerKey === 'player' ? this.player : this.opponent;
    const defender = defenderKey === 'player' ? this.player : this.opponent;

    if (card.type === 'evade') {
      this.fx('cardClash', { atkCard, defCard: card, attackerKey, defenderKey, mode: 'evade' });
      this.log(`${defender.name} realizou Z-VANISH e esquivou do ataque de ${attacker.name}!`, 'evade');
      defender.isOpenGuard = true;
      // Leader Passive: Trunks Z-Vanish bonus
      if (defender.leader && defender.leader.id === 'trunks') {
        const extraDraw = defender.isAwakened ? 2 : 1;
        const kiRefund = defender.isAwakened ? 2 : 0;
        this.drawCard(defender, extraDraw);
        if (kiRefund > 0) defender.ki = Math.min(10, defender.ki + kiRefund);
        this.log(`🗡️ Passive Trunks: Z-Vanish comprou ${extraDraw} carta(s)!`, 'info');
      }
    } else if (card.type === 'counter') {
      this.fx('cardClash', { atkCard, defCard: card, attackerKey, defenderKey, mode: 'counter' });
      this.log(`${defender.name} realizou Z-COUNTER e contra-atacou!`, 'evade');
      defender.isOpenGuard = false;
    } else if (card.type === 'defense' || card.type === 'block') {
      this.fx('cardClash', { atkCard, defCard: card, attackerKey, defenderKey, mode: 'defense' });
      let blockAmount = card.block || Math.floor((atkCard?.power || 20) * 0.5);
      // Leader Passive: Piccolo gains +15 Block on Defense cards
      if (defender.leader && defender.leader.id === 'piccolo') {
        blockAmount += 15;
      }
      const netDamage = Math.max(0, (atkCard?.power || 20) - blockAmount);
      defender.hp = Math.max(0, defender.hp - netDamage);
      defender.shields = Math.ceil(defender.hp / 50);
      this.log(`${defender.name} usou ${card.name} e bloqueou ${blockAmount} de dano! (Dano resultante: ${netDamage})`, 'evade');
      this.notifyState();
    } else if (card.isBeam && atkCard && atkCard.isBeam) {
      this.startBeamClashLoop();
      return;
    }

    this.pendingAttack = null;
    this.state = 'FREE_ACTION';
    this._passTurn(attackerKey);
  }

  startBeamClashLoop() {
    this.state = 'BEAM_CLASH';
    this.beamClashData = { p1Progress: 50, timer: 6.0 };
    this.log(`🔥 DISPUTA DE BEAM KAMEHAMEHA! Pressione o botão rapidamente!`, 'info');

    this.clearBeamClashLoop();
    this.beamClashInterval = setInterval(() => {
      if (this.state !== 'BEAM_CLASH' || !this.beamClashData) {
        this.clearBeamClashLoop();
        return;
      }

      const attackerKey = this.pendingAttack ? this.pendingAttack.attackerKey : 'player';
      const defenderKey = attackerKey === 'player' ? 'opponent' : 'player';

      this.beamClashData.p1Progress = Math.max(0, this.beamClashData.p1Progress - 1.2);
      this.beamClashData.timer -= 0.1;

      this.fx('beamClash', {
        p1Progress: this.beamClashData.p1Progress,
        p1Color: this.player.leader.color,
        p2Color: this.opponent.leader.color
      });

      if (this.beamClashData.p1Progress <= 0) {
        this.clearBeamClashLoop();
        this.resolveBeamClashWinner(defenderKey);
      } else if (this.beamClashData.p1Progress >= 100) {
        this.clearBeamClashLoop();
        this.resolveBeamClashWinner(attackerKey);
      } else if (this.beamClashData.timer <= 0) {
        this.clearBeamClashLoop();
        const winnerKey = this.beamClashData.p1Progress >= 50 ? attackerKey : defenderKey;
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

    const attackerKey = this.pendingAttack ? this.pendingAttack.attackerKey : 'player';
    const defenderKey = attackerKey === 'player' ? 'opponent' : 'player';

    if (actorKey === 'opponent') {
      this.beamClashData.p1Progress = Math.max(0, this.beamClashData.p1Progress - 7);
      if (this.beamClashData.p1Progress <= 0) {
        this.resolveBeamClashWinner(defenderKey);
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
      this.resolveBeamClashWinner(attackerKey);
    }
  }

  resolveBeamClashWinner(winnerKey, loserHp) {
    if (loserHp === undefined && !this.beamClashData) return;

    this.beamClashData = null;
    this.clearBeamClashLoop();

    const winner = winnerKey === 'player' ? this.player : this.opponent;
    const loser = winnerKey === 'player' ? this.opponent : this.player;

    if (loserHp !== undefined) {
      loser.hp = Math.max(0, loserHp);
      loser.shields = Math.ceil(loser.hp / 50);
      this.state = 'FREE_ACTION';
      this.pendingAttack = null;
      this.fx('kamehameha', { attackerKey: winnerKey, isGolden: true });
      this.log(`💥 DISPUTA DE BEAM VENCIDA POR ${winner.name}! Causou 80 HP de dano massivo em ${loser.name}!`, 'damage');
      if (loser.hp <= 0) {
        this.state = 'GAME_OVER';
        this.winner = winnerKey;
      }
      this.checkAwaken(loser);
      this.notifyState();
      return;
    }

    const originalAttacker = this.pendingAttack ? this.pendingAttack.attackerKey : this.initiative;
    loser.hp = Math.max(0, loser.hp - 80);
    loser.shields = Math.ceil(loser.hp / 50);

    if (this.onLocalAction && !this.isAiMatch) {
      const attackerKey = this.pendingAttack ? this.pendingAttack.attackerKey : 'player';
      const role = winnerKey === attackerKey ? 'attacker' : 'defender';
      this.onLocalAction('beamClashEnd', { winner: role, loserHp: loser.hp });
    }

    this.fx('kamehameha', { attackerKey: winnerKey, isGolden: true });
    this.log(`💥 DISPUTA DE BEAM VENCIDA POR ${winner.name}! Causou 80 HP de dano massivo em ${loser.name}!`, 'damage');
    
    this.state = 'FREE_ACTION';
    this.pendingAttack = null;

    if (loser.hp <= 0) {
      this.state = 'GAME_OVER';
      this.winner = winnerKey;
    }
    this.notifyState();

    if (this.state === 'FREE_ACTION') {
      this._passTurn(originalAttacker);
    }
  }

  checkAwaken(fighter) {
    if (!fighter.isAwakened && fighter.hp <= (fighter.leader.awakenThresholdHp || 200)) {
      fighter.isAwakened = true;
      this.fx('awaken', { color: fighter.leader.color });
      this.log(`🔥 ${fighter.name} DESPERTOU A FORMA ${fighter.leader.awakenedName}!`, 'info');
    }
  }

  // ── AI TURN EXECUTION WITH FAILSAFE PASS ─────────────────────────────
  executeAiTurn() {
    if (this.state === 'FREE_ACTION' && this.initiative === 'opponent') {
      const playableAtk = this.opponent.hand.findIndex(c => (c.type === 'attack' || c.type === 'tech') && c.cost <= this.opponent.ki);
      if (playableAtk !== -1) {
        this.playCard('opponent', playableAtk);
      } else if (this.opponent.ki < 10) {
        this.chargeKi('opponent');
      } else {
        // AI has 10 Ki and no playable attack cards: MUST pass turn!
        this.passTurn('opponent');
      }
    } else if (this.state === 'ATTACK_PENDING' && this.pendingAttack?.attackerKey === 'player') {
      const defIdx = this.opponent.hand.findIndex(c => (c.type === 'evade' || c.type === 'defense' || c.isBeam) && c.cost <= this.opponent.ki);
      if (defIdx !== -1) {
        this.playCard('opponent', defIdx);
      } else {
        // If AI has no defensive card to play, resolve attack after 1s
        setTimeout(() => {
          if (this.state === 'ATTACK_PENDING') {
            this.clearReactionTimer();
            this.resolveUnansweredAttack();
          }
        }, 1000);
      }
    }
  }
}
