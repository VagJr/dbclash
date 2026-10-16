import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function write(rel, text) {
  const full = path.join(root, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, text, "utf8");
}

function backup(rel) {
  const src = path.join(root, rel);
  const dst = `${src}.release-fix-01.bak`;
  if (!fs.existsSync(dst)) fs.copyFileSync(src, dst);
}

function methodSource(fn) {
  return fn
    .toString()
    .split("\n")
    .map(line => `  ${line}`)
    .join("\n");
}

function findMethodRange(src, methodName) {
  const escaped = methodName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`\\n\\s{2}${escaped}\\s*\\(`, "m");
  const m = re.exec(src);
  if (!m) throw new Error(`Método não encontrado: ${methodName}`);

  const start = m.index + 1;
  const brace = src.indexOf("{", m.index);
  if (brace < 0) throw new Error(`Chave inicial não encontrada: ${methodName}`);

  let depth = 0;
  let quote = null;
  let template = false;
  let lineComment = false;
  let blockComment = false;
  let escape = false;

  for (let i = brace; i < src.length; i++) {
    const ch = src[i];
    const next = src[i + 1];

    if (lineComment) {
      if (ch === "\n") lineComment = false;
      continue;
    }
    if (blockComment) {
      if (ch === "*" && next === "/") {
        blockComment = false;
        i++;
      }
      continue;
    }
    if (quote) {
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === "\\") {
        escape = true;
        continue;
      }
      if (ch === quote) quote = null;
      continue;
    }
    if (template) {
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === "\\") {
        escape = true;
        continue;
      }
      if (ch === "`") template = false;
      continue;
    }

    if (ch === "/" && next === "/") {
      lineComment = true;
      i++;
      continue;
    }
    if (ch === "/" && next === "*") {
      blockComment = true;
      i++;
      continue;
    }
    if (ch === "'" || ch === '"') {
      quote = ch;
      continue;
    }
    if (ch === "`") {
      template = true;
      continue;
    }

    if (ch === "{") depth++;
    if (ch === "}") {
      depth--;
      if (depth === 0) return { start, end: i + 1 };
    }
  }

  throw new Error(`Fim do método não encontrado: ${methodName}`);
}

function replaceMethod(src, methodName, replacement) {
  const { start, end } = findMethodRange(src, methodName);
  return src.slice(0, start) + replacement.trimEnd() + src.slice(end);
}

function insertBeforeMethod(src, methodName, block) {
  const { start } = findMethodRange(src, methodName);
  return src.slice(0, start) + block.trimEnd() + "\n\n" + src.slice(start);
}

const CoreMethods = class {
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

  reset() {
    this.clearBeamClashLoop();
    this.clearReactionTimer();
    this.clearOpenGuardTimers();

    this.state = 'LOBBY';
    this.initiative = 'player';
    this.winner = null;
    this.gameOverNotified = false;
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
    this.openGuardTimers = { player: null, opponent: null };
    this.lastMashAt = { player: 0, opponent: 0 };
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

  _chargeKi(actorKey) {
    if (!['player', 'opponent'].includes(actorKey)) return false;
    if (this.state !== 'FREE_ACTION' || this.initiative !== actorKey) return false;

    const actor = actorKey === 'player' ? this.player : this.opponent;
    if (!actor || actor.ki >= 10) {
      if (actor) this.log(`${actor.name} já está com Ki máximo (10/10 Ki).`, 'info');
      return false;
    }

    actor.ki = Math.min(10, actor.ki + 2);
    this._setOpenGuard(actorKey, 3500);

    this.fx('kiAura', {
      attackerKey: actorKey,
      x: actorKey === 'player' ? 300 : 900,
      y: 500,
      color: actor.leader.color
    });

    this.log(`${actor.name} carregou Ki (+2 Ki, total ${actor.ki}) e abriu a guarda por 3,5s.`, 'info');
    this._passTurn(actorKey);
    return true;
  }

  _playCard(actorKey, handIndex, remoteCardId) {
    if (!['player', 'opponent'].includes(actorKey)) return false;
    if (this.state === 'GAME_OVER' || this.state === 'BEAM_CLASH') return false;

    const actor = actorKey === 'player' ? this.player : this.opponent;
    if (!actor) return false;

    let actualIndex = Number.isInteger(handIndex) ? handIndex : -1;
    if (remoteCardId) {
      const foundIndex = actor.hand.findIndex(c => c.id === remoteCardId);
      if (foundIndex !== -1) actualIndex = foundIndex;
    }

    if (actualIndex < 0 || actualIndex >= actor.hand.length) return false;
    const card = actor.hand[actualIndex];
    if (!card || actor.ki < card.cost) return false;

    let mode = null;

    if (this.state === 'FREE_ACTION') {
      if (this.initiative !== actorKey) return false;
      if (!['attack', 'tech'].includes(card.type)) return false;
      mode = 'action';
    } else if (this.state === 'ATTACK_PENDING') {
      if (!this.pendingAttack) return false;

      const defenderKey = this.pendingAttack.attackerKey === 'player' ? 'opponent' : 'player';
      if (actorKey !== defenderKey) return false;

      const atkCard = this.pendingAttack.card;
      const isBeamResponse = !!(card.isBeam && atkCard && atkCard.isBeam);
      const isReaction = ['defense', 'evade', 'counter'].includes(card.type) || isBeamResponse;
      if (!isReaction) return false;
      if (card.type === 'evade' && actor.isOpenGuard) return false;

      mode = 'reaction';
    } else {
      return false;
    }

    actor.ki -= card.cost;
    actor.hand.splice(actualIndex, 1);
    actor.discard.push(card.id);

    if (mode === 'action') {
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

      if (isBeamAttack) this.fx('attackCharging', { card, attackerKey: actorKey });
      this.startReactionTimer();

      if (this.isAiMatch && actorKey === 'player') {
        setTimeout(() => this.executeAiTurn(), 250);
      }
    } else {
      this.clearReactionTimer();
      this.resolveReaction(actorKey, card);
    }

    this.notifyState();
    return true;
  }

  resolveUnansweredAttack() {
    if (!this.pendingAttack || this.attackResolved || this.state !== 'ATTACK_PENDING') return false;

    this.attackResolved = true;
    const { attackerKey, card } = this.pendingAttack;
    const attacker = attackerKey === 'player' ? this.player : this.opponent;
    const defenderKey = attackerKey === 'player' ? 'opponent' : 'player';
    const defender = defenderKey === 'player' ? this.player : this.opponent;

    let dmg = Number(card?.power ?? 0);
    if (!Number.isFinite(dmg)) dmg = 0;
    if (defender.isOpenGuard && dmg > 0) dmg = Math.floor(dmg * 1.5);

    const prevShields = defender.shields;
    defender.hp = Math.max(0, defender.hp - dmg);
    defender.shields = Math.ceil(defender.hp / 50);

    const gokuKiGain = dmg > 0 && defender.leader?.id === 'goku' && defender.ki < 10;
    if (gokuKiGain) {
      defender.ki = Math.min(10, defender.ki + 1);
      this.log(`⚡ Passive Goku: +1 Ki por receber dano!`, 'info');
    }

    const gohanShieldBreak = attacker.leader?.id === 'gohan' && prevShields > defender.shields;
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
        passives: Object.keys(passives).length ? passives : undefined
      });
    }

    this._playAttackFX(card, attackerKey, dmg);
    if (this.checkGameOver()) return true;

    this.pendingAttack = null;
    this.state = 'FREE_ACTION';
    this._passTurn(attackerKey);
    return true;
  }

  resolveReaction(defenderKey, card) {
    if (!this.pendingAttack || this.state !== 'ATTACK_PENDING') return false;

    const { attackerKey, card: atkCard } = this.pendingAttack;
    const expectedDefenderKey = attackerKey === 'player' ? 'opponent' : 'player';
    if (defenderKey !== expectedDefenderKey) return false;

    const attacker = attackerKey === 'player' ? this.player : this.opponent;
    const defender = defenderKey === 'player' ? this.player : this.opponent;

    if (card.type === 'evade') {
      this.fx('cardClash', { atkCard, defCard: card, attackerKey, defenderKey, mode: 'evade' });
      this.log(`${defender.name} realizou Z-VANISH e esquivou do ataque de ${attacker.name}!`, 'evade');
      this._clearOpenGuard(defenderKey);

      if (defender.leader?.id === 'trunks') {
        const extraDraw = defender.isAwakened ? 2 : 1;
        const kiRefund = defender.isAwakened ? 2 : 0;
        this.drawCard(defender, extraDraw);
        if (kiRefund) defender.ki = Math.min(10, defender.ki + kiRefund);
        this.log(`🗡️ Passive Trunks: Z-Vanish comprou ${extraDraw} carta(s)!`, 'info');
      }
    } else if (card.type === 'counter') {
      this.fx('cardClash', { atkCard, defCard: card, attackerKey, defenderKey, mode: 'counter' });
      this.log(`${defender.name} realizou Z-COUNTER e cancelou o ataque!`, 'evade');
      this._clearOpenGuard(defenderKey);
    } else if (card.type === 'defense' || card.type === 'block') {
      this.fx('cardClash', { atkCard, defCard: card, attackerKey, defenderKey, mode: 'defense' });

      let blockAmount = Number(card.block ?? Math.floor((atkCard?.power || 0) * 0.5));
      if (!Number.isFinite(blockAmount)) blockAmount = 0;
      if (defender.leader?.id === 'piccolo') blockAmount += 15;

      let incoming = Number(atkCard?.power ?? 0);
      if (!Number.isFinite(incoming)) incoming = 0;
      if (defender.isOpenGuard && incoming > 0) incoming = Math.floor(incoming * 1.5);

      const netDamage = Math.max(0, incoming - blockAmount);
      defender.hp = Math.max(0, defender.hp - netDamage);
      defender.shields = Math.ceil(defender.hp / 50);

      this.log(`${defender.name} usou ${card.name} e bloqueou ${blockAmount}. Dano resultante: ${netDamage}.`, 'evade');
      this.checkAwaken(defender);
      if (this.checkGameOver()) return true;
    } else if (card.isBeam && atkCard?.isBeam) {
      this.startBeamClashLoop(card);
      return true;
    } else {
      return false;
    }

    this.pendingAttack = null;
    this.state = 'FREE_ACTION';
    this._passTurn(attackerKey);
    return true;
  }

  startBeamClashLoop(defenderCard = null) {
    if (!this.pendingAttack) return false;

    const attackerKey = this.pendingAttack.attackerKey;
    const defenderKey = attackerKey === 'player' ? 'opponent' : 'player';

    this.state = 'BEAM_CLASH';
    this.beamClashData = {
      p1Progress: 50,
      timer: 6.0,
      attackerKey,
      defenderKey,
      attackerCardId: this.pendingAttack.card?.id || null,
      defenderCardId: defenderCard?.id || null
    };

    this.lastMashAt = { player: 0, opponent: 0 };
    this.log(`🔥 DISPUTA DE BEAM! Pressione o botão rapidamente!`, 'info');

    this.clearBeamClashLoop();
    this.beamClashInterval = setInterval(() => {
      if (this.state !== 'BEAM_CLASH' || !this.beamClashData) {
        this.clearBeamClashLoop();
        return;
      }

      this.beamClashData.timer = Math.max(0, this.beamClashData.timer - 0.1);
      this.notifyState();

      if (this.beamClashData.p1Progress <= 0) {
        this.clearBeamClashLoop();
        this.resolveBeamClashWinner('opponent');
      } else if (this.beamClashData.p1Progress >= 100) {
        this.clearBeamClashLoop();
        this.resolveBeamClashWinner('player');
      } else if (this.beamClashData.timer <= 0) {
        this.clearBeamClashLoop();
        this.resolveBeamClashWinner(this.beamClashData.p1Progress >= 50 ? 'player' : 'opponent');
      }
    }, 100);

    return true;
  }

  _mashBeamClash(actorKey = 'player') {
    if (this.state !== 'BEAM_CLASH' || !this.beamClashData) return false;
    if (!['player', 'opponent'].includes(actorKey)) return false;

    const now = Date.now();
    if (!this.lastMashAt) this.lastMashAt = { player: 0, opponent: 0 };
    if (now - (this.lastMashAt[actorKey] || 0) < 60) return false;
    this.lastMashAt[actorKey] = now;

    const delta = actorKey === 'player' ? 7 : -7;
    this.beamClashData.p1Progress = Math.max(
      0,
      Math.min(100, this.beamClashData.p1Progress + delta)
    );

    this.fx('beamClash', {
      p1Progress: this.beamClashData.p1Progress,
      p1Color: this.player.leader.color,
      p2Color: this.opponent.leader.color
    });
    this.notifyState();

    if (this.beamClashData.p1Progress >= 100) {
      this.resolveBeamClashWinner('player');
    } else if (this.beamClashData.p1Progress <= 0) {
      this.resolveBeamClashWinner('opponent');
    }

    return true;
  }

  resolveBeamClashWinner(winnerKey, loserHp) {
    if (!['player', 'opponent'].includes(winnerKey)) return false;
    if (loserHp === undefined && !this.beamClashData) return false;

    const originalAttacker =
      this.pendingAttack?.attackerKey ||
      this.beamClashData?.attackerKey ||
      this.initiative;

    const winner = winnerKey === 'player' ? this.player : this.opponent;
    const loser = winnerKey === 'player' ? this.opponent : this.player;

    this.clearBeamClashLoop();
    this.beamClashData = null;

    loser.hp = loserHp === undefined
      ? Math.max(0, loser.hp - 80)
      : Math.max(0, Number(loserHp) || 0);
    loser.shields = Math.ceil(loser.hp / 50);

    if (this.onLocalAction && !this.isAiMatch && loserHp === undefined) {
      const attackerKey = this.pendingAttack?.attackerKey || originalAttacker;
      this.onLocalAction('beamClashEnd', {
        winner: winnerKey === attackerKey ? 'attacker' : 'defender',
        loserHp: loser.hp
      });
    }

    this.fx('kamehameha', { attackerKey: winnerKey, isGolden: true, damage: 80 });
    this.log(`💥 DISPUTA DE BEAM VENCIDA POR ${winner.name}! Causou 80 HP de dano em ${loser.name}!`, 'damage');
    this.checkAwaken(loser);

    this.pendingAttack = null;
    this.state = 'FREE_ACTION';

    if (this.checkGameOver()) return true;

    this._passTurn(originalAttacker);
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
};

const ServerOnlyMethods = class {
  getFullSyncState(viewerKey = 'player') {
    const hideHand = size => Array.from({ length: size }, (_, index) => ({
      id: `__hidden_${index}`,
      hidden: true
    }));

    return {
      state: this.state,
      initiative: this.initiative,
      winner: this.winner,
      pendingAttack: this.pendingAttack,
      beamClashData: this.beamClashData,
      reactionSecondsLeft: this.reactionSecondsLeft,
      player: {
        name: this.player.name,
        hp: this.player.hp,
        maxHp: this.player.maxHp,
        ki: this.player.ki,
        shields: this.player.shields,
        isAwakened: this.player.isAwakened,
        isOpenGuard: this.player.isOpenGuard,
        hand: viewerKey === 'player' ? this.player.hand : hideHand(this.player.hand.length),
        deckCount: this.player.deck.length,
        discard: this.player.discard,
        leader: this.player.leader
      },
      opponent: {
        name: this.opponent.name,
        hp: this.opponent.hp,
        maxHp: this.opponent.maxHp,
        ki: this.opponent.ki,
        shields: this.opponent.shields,
        isAwakened: this.opponent.isAwakened,
        isOpenGuard: this.opponent.isOpenGuard,
        hand: viewerKey === 'opponent' ? this.opponent.hand : hideHand(this.opponent.hand.length),
        deckCount: this.opponent.deck.length,
        discard: this.opponent.discard,
        leader: this.opponent.leader
      }
    };
  }
};

const ClientOnlyMethods = class {
  applyFullSyncState(data) {
    if (!data || this.isAiMatch) return;

    const oldState = this.state;
    this.state = data.state;
    this.initiative = data.initiative;
    this.winner = data.winner || null;
    this.pendingAttack = data.pendingAttack || null;
    this.beamClashData = data.beamClashData || null;
    this.reactionSecondsLeft = Number(data.reactionSecondsLeft ?? 0);

    const applyFighter = (target, source) => {
      if (!source) return;
      target.name = source.name || target.name;
      target.hp = source.hp;
      target.maxHp = source.maxHp;
      target.ki = source.ki;
      target.shields = source.shields;
      target.isAwakened = !!source.isAwakened;
      target.isOpenGuard = !!source.isOpenGuard;
      target.hand = Array.isArray(source.hand) ? source.hand : [];
      target.discard = Array.isArray(source.discard) ? source.discard : [];
      target.deck = Array.from({ length: Number(source.deckCount || 0) }, () => '__hidden__');
      if (source.leader) target.leader = source.leader;
    };

    applyFighter(this.player, data.player);
    applyFighter(this.opponent, data.opponent);

    if (oldState !== 'BEAM_CLASH' && this.state === 'BEAM_CLASH') {
      this.log(`🔥 DISPUTA DE BEAM! Pressione o botão rapidamente!`, 'info');
    }

    if (this.state === 'ATTACK_PENDING' && this.onTimerTick) {
      this.onTimerTick(this.reactionSecondsLeft, 3.0);
    }

    if (this.state === 'GAME_OVER') this.checkGameOver();
    this.notifyState();
  }
};

function patchEngine(rel, isServer) {
  backup(rel);
  let src = read(rel);

  for (const name of [
    'checkGameOver',
    'reset',
    '_chargeKi',
    '_playCard',
    'resolveUnansweredAttack',
    'resolveReaction',
    'startBeamClashLoop',
    '_mashBeamClash',
    'resolveBeamClashWinner'
  ]) {
    src = replaceMethod(src, name, methodSource(CoreMethods.prototype[name]));
  }

  if (!src.includes('clearOpenGuardTimers() {')) {
    const openGuardBlock = [
      methodSource(CoreMethods.prototype.clearOpenGuardTimers),
      methodSource(CoreMethods.prototype._clearOpenGuard),
      methodSource(CoreMethods.prototype._setOpenGuard)
    ].join('\n\n');
    src = insertBeforeMethod(src, 'hasDefensiveResponse', openGuardBlock);
  }

  if (!src.includes('_playAttackFX(card, attackerKey, dmg) {')) {
    src = insertBeforeMethod(src, 'applyResolvedAttack', methodSource(CoreMethods.prototype._playAttackFX));
  }

  src = src.replace(
    /if \(this\.player\.leader\.id === 'frieza'\) this\.player\.ki = 5;/g,
    "if (this.player.leader.id === 'frieza') this.player.ki = 6;"
  );
  src = src.replace(
    /if \(this\.opponent\.leader\.id === 'frieza'\) this\.opponent\.ki = 5;/g,
    "if (this.opponent.leader.id === 'frieza') this.opponent.ki = 6;"
  );

  if (isServer) {
    src = replaceMethod(
      src,
      'getFullSyncState',
      methodSource(ServerOnlyMethods.prototype.getFullSyncState)
    );
  } else {
    src = replaceMethod(
      src,
      'applyFullSyncState',
      methodSource(ClientOnlyMethods.prototype.applyFullSyncState)
    );

    src = src.replace(
      /this\.onLocalAction\('chargeKi', \{\}\);\s*this\._chargeKi\('player'\);\s*return;/,
      "this.onLocalAction('chargeKi', {});\n      return;"
    );
    src = src.replace(
      /this\.onLocalAction\('passTurn', \{\}\);\s*this\._passTurn\('player'\);\s*return;/,
      "this.onLocalAction('passTurn', {});\n      return;"
    );
    src = src.replace(
      /this\.onLocalAction\('playCard', \{ cardIndex: handIndex, cardId: card \? card\.id : null \}\);\s*this\._playCard\('player', handIndex\);\s*return;/,
      "this.onLocalAction('playCard', { cardIndex: handIndex, cardId: card ? card.id : null });\n      return;"
    );
  }

  write(rel, src);
  console.log(`[OK] ${rel}`);
}

for (const rel of [
  'server.js',
  'package.json',
  'server/server-engine.js',
  'js/game-engine.js',
  'js/multiplayer-manager.js'
]) {
  if (!fs.existsSync(path.join(root, rel))) {
    throw new Error(`Arquivo obrigatório não encontrado: ${rel}. Execute na raiz do dbclash.`);
  }
}

patchEngine('server/server-engine.js', true);
patchEngine('js/game-engine.js', false);

// Multiplayer: remove local simulation and guest winner mismatch.
backup('js/multiplayer-manager.js');
let mm = read('js/multiplayer-manager.js');

mm = mm.replace(
  /const pDeck = this\.myDeck[\s\S]*?this\.startSyncedMatch\(pLeader,\s*payload\.opponent\.leader \|\| payload\.opponent\.username,\s*setupObj\);/,
  "this.startSyncedMatch(pLeader, payload.opponent.leader || 'vegeta');"
);

mm = mm.replace(
  /this\.clearMatchmaking\(\);\s*\n\s*const mmModal/,
  "this.clearMatchmaking();\n      this.isPaired = true;\n\n      const mmModal"
);

mm = mm.replace(
  /if \(payload\.pendingAttack\) \{\s*stateObj\.pendingAttack = \{ \.\.\.payload\.pendingAttack, attackerKey: payload\.pendingAttack\.attackerKey === 'player' \? 'opponent' : 'player' \};\s*\}/,
  `if (payload.pendingAttack) {
            stateObj.pendingAttack = {
              ...payload.pendingAttack,
              attackerKey: payload.pendingAttack.attackerKey === 'player' ? 'opponent' : 'player'
            };
          }
          if (payload.winner === 'player') stateObj.winner = 'opponent';
          else if (payload.winner === 'opponent') stateObj.winner = 'player';`
);

mm = mm.replace(
  /  startSyncedMatch\(pLeader, oLeader, setupObj\) \{[\s\S]*?\n  \}/,
  `  startSyncedMatch(pLeader, oLeader) {
    this.engine.reset();
    this.engine.isAiMatch = false;
    sceneManager.switchScene(GAME_SCENES.ARENA);
  }`
);

write('js/multiplayer-manager.js', mm);
console.log('[OK] js/multiplayer-manager.js');

// Server: private state projections, no deck leak, no duplicate FX/disconnect.
backup('server.js');
let server = read('server.js');

server = server.replace(/\s*,?\s*deck:\s*socket\.userData\.deck/g, '');
server = server.replace(/\s*,?\s*deck:\s*opponentSocket\.userData\.deck/g, '');

server = server.replace(
  "io.to(roomCode).emit('state_update', eng.getFullSyncState());",
  "opponentSocket.emit('state_update', eng.getFullSyncState('player'));\n          socket.emit('state_update', eng.getFullSyncState('opponent'));"
);

server = server.replace(
  /\s*engine\.onFx = \(type, data\) => \{\s*io\.to\(roomCode\)\.emit\('game_fx', \{ type, data \}\);\s*\};/,
  ''
);

server = server.replace(
  /\n\s*socket\.on\('disconnect', \(\) => \{\s*console\.log\(`\[Socket\] Disconnected:[\s\S]*?delete activeRooms\[socket\.roomCode\]; \/\/ Clean up engine\s*\}\s*\}\);\s*/m,
  '\n'
);

server = server.replace(
  /if \(socket\.roomCode\) \{\s*socket\.to\(socket\.roomCode\)\.emit\('opponent_disconnected', \{\s*uid: socket\.userData\?\.uid \|\| socket\.id,\s*message: 'Oponente desconectou-se da partida\.'\s*\}\);\s*\}/,
  `if (socket.roomCode) {
      socket.to(socket.roomCode).emit('opponent_disconnected', {
        uid: socket.userData?.uid || socket.id,
        message: 'Oponente desconectou-se da partida.'
      });
      delete activeRooms[socket.roomCode];
    }`
);

write('server.js', server);
console.log('[OK] server.js');

// package.json + first release regression suite.
backup('package.json');
const pkg = JSON.parse(read('package.json'));
pkg.scripts ||= {};
pkg.scripts['test:core'] = 'node scripts/test-release-core.mjs';
pkg.scripts.test = 'npm run test:core';
pkg.scripts.check = 'npm run test:core';
write('package.json', JSON.stringify(pkg, null, 2) + '\n');
console.log('[OK] package.json');

write('scripts/test-release-core.mjs', `import assert from 'node:assert/strict';
import { GameEngine } from '../server/server-engine.js';
import { getCardById } from '../js/card-database.js';

function makeEngine() {
  const e = new GameEngine(() => {}, () => {});
  e.startMatch('goku', 'vegeta', [], false);
  e.clearReactionTimer();
  e.clearBeamClashLoop();
  return e;
}

function snapshot(e) {
  return JSON.stringify({
    state: e.state,
    initiative: e.initiative,
    player: {
      hp: e.player.hp,
      ki: e.player.ki,
      hand: e.player.hand.map(c => c.id),
      discard: [...e.player.discard]
    },
    opponent: {
      hp: e.opponent.hp,
      ki: e.opponent.ki,
      hand: e.opponent.hand.map(c => c.id),
      discard: [...e.opponent.discard]
    },
    pendingAttack: e.pendingAttack?.card?.id || null
  });
}

let passed = 0;
function test(name, fn) {
  try {
    fn();
    console.log('PASS', name);
    passed++;
  } catch (err) {
    console.error('FAIL', name);
    throw err;
  }
}

test('chargeKi fora da iniciativa não muta estado', () => {
  const e = makeEngine();
  e.state = 'FREE_ACTION';
  e.initiative = 'opponent';
  e.player.ki = 2;
  const before = snapshot(e);
  assert.equal(e._chargeKi('player'), false);
  assert.equal(snapshot(e), before);
  e.reset();
});

test('carta defensiva em FREE_ACTION não é consumida', () => {
  const e = makeEngine();
  e.state = 'FREE_ACTION';
  e.initiative = 'player';
  e.player.ki = 10;
  e.player.hand = [{ ...getCardById('def_01'), instanceId: 'x' }];
  const before = snapshot(e);
  assert.equal(e._playCard('player', 0), false);
  assert.equal(snapshot(e), before);
  e.reset();
});

test('atacante não pode reagir ao próprio ataque', () => {
  const e = makeEngine();
  e.state = 'ATTACK_PENDING';
  e.pendingAttack = { attackerKey: 'player', card: getCardById('atk_02') };
  e.player.ki = 10;
  e.player.hand = [{ ...getCardById('def_01'), instanceId: 'x' }];
  const before = snapshot(e);
  assert.equal(e._playCard('player', 0), false);
  assert.equal(snapshot(e), before);
  e.reset();
});

test('reação inválida não cancela ataque nem consome carta', () => {
  const e = makeEngine();
  e.state = 'ATTACK_PENDING';
  e.pendingAttack = { attackerKey: 'player', card: getCardById('atk_01') };
  e.opponent.ki = 10;
  e.opponent.hand = [{ ...getCardById('atk_01'), instanceId: 'x' }];
  const before = snapshot(e);
  assert.equal(e._playCard('opponent', 0), false);
  assert.equal(snapshot(e), before);
  e.reset();
});

test('dano letal após defesa encerra a partida', () => {
  const e = makeEngine();
  e.state = 'ATTACK_PENDING';
  e.pendingAttack = { attackerKey: 'player', card: { ...getCardById('atk_03'), power: 65 } };
  e.opponent.hp = 10;
  e.opponent.shields = 1;
  e.opponent.ki = 10;
  e.opponent.hand = [{ ...getCardById('def_08'), block: 20, instanceId: 'd' }];
  assert.equal(e._playCard('opponent', 0), true);
  assert.equal(e.opponent.hp, 0);
  assert.equal(e.state, 'GAME_OVER');
  assert.equal(e.winner, 'player');
  e.reset();
});

test('beam clash usa eixo player/opponent consistente em qualquer atacante', () => {
  const e = makeEngine();
  e.state = 'BEAM_CLASH';
  e.pendingAttack = { attackerKey: 'opponent', card: getCardById('atk_02') };
  e.beamClashData = {
    p1Progress: 50,
    timer: 6,
    attackerKey: 'opponent',
    defenderKey: 'player'
  };
  e.lastMashAt = { player: 0, opponent: 0 };

  assert.equal(e._mashBeamClash('opponent'), true);
  assert.equal(e.beamClashData.p1Progress, 43);

  e.lastMashAt.player = 0;
  assert.equal(e._mashBeamClash('player'), true);
  assert.equal(e.beamClashData.p1Progress, 50);
  e.reset();
});

test('sync inclui winner/awaken/openGuard/deckCount e esconde mão rival', () => {
  const e = makeEngine();
  e.player.hand = [{ ...getCardById('atk_01'), instanceId: 'a' }];
  e.opponent.hand = [
    { ...getCardById('atk_02'), instanceId: 'b' },
    { ...getCardById('def_01'), instanceId: 'c' }
  ];
  e.player.isAwakened = true;
  e.player.isOpenGuard = true;
  e.winner = 'player';

  const p1 = e.getFullSyncState('player');
  const p2 = e.getFullSyncState('opponent');

  assert.equal(p1.winner, 'player');
  assert.equal(p1.player.isAwakened, true);
  assert.equal(p1.player.isOpenGuard, true);
  assert.equal(p1.player.deckCount, e.player.deck.length);
  assert.equal(p1.player.hand[0].id, 'atk_01');
  assert.equal(p1.opponent.hand[0].hidden, true);
  assert.equal(p2.opponent.hand[0].id, 'atk_02');
  assert.equal(p2.player.hand[0].hidden, true);
  e.reset();
});

console.log(\\\`\\\\nCORE RELEASE TESTS: \\\${passed} PASS / 0 FAIL\\\`);
`);

console.log('[OK] scripts/test-release-core.mjs');
console.log('\\nPATCH RELEASE FIX 01 APLICADO.');
