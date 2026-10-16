import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = process.cwd();
const scriptDir = path.dirname(fileURLToPath(import.meta.url));

function read(rel) { return fs.readFileSync(path.join(root, rel), 'utf8'); }
function write(rel, text) {
  const full = path.join(root, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, text, 'utf8');
}
function backup(rel) {
  const src = path.join(root, rel);
  const dst = `${src}.release-fix-02.bak`;
  if (!fs.existsSync(dst)) fs.copyFileSync(src, dst);
}
function methodSource(fn) {
  return fn.toString().split('\n').map(line => `  ${line}`).join('\n');
}
function findMethodRange(src, methodName) {
  const escaped = methodName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`\\n\\s{2}${escaped}\\s*\\(`, 'm');
  const m = re.exec(src);
  if (!m) throw new Error(`Metodo nao encontrado: ${methodName}`);
  const start = m.index + 1;
  const brace = src.indexOf('{', m.index);
  if (brace < 0) throw new Error(`Chave inicial nao encontrada: ${methodName}`);

  let depth = 0;
  let quote = null;
  let template = false;
  let lineComment = false;
  let blockComment = false;
  let escape = false;

  for (let i = brace; i < src.length; i++) {
    const ch = src[i];
    const next = src[i + 1];

    if (lineComment) { if (ch === '\n') lineComment = false; continue; }
    if (blockComment) { if (ch === '*' && next === '/') { blockComment = false; i++; } continue; }
    if (quote) {
      if (escape) { escape = false; continue; }
      if (ch === '\\') { escape = true; continue; }
      if (ch === quote) quote = null;
      continue;
    }
    if (template) {
      if (escape) { escape = false; continue; }
      if (ch === '\\') { escape = true; continue; }
      if (ch === '`') template = false;
      continue;
    }
    if (ch === '/' && next === '/') { lineComment = true; i++; continue; }
    if (ch === '/' && next === '*') { blockComment = true; i++; continue; }
    if (ch === "'" || ch === '"') { quote = ch; continue; }
    if (ch === '`') { template = true; continue; }
    if (ch === '{') depth++;
    if (ch === '}') {
      depth--;
      if (depth === 0) return { start, end: i + 1 };
    }
  }
  throw new Error(`Fim do metodo nao encontrado: ${methodName}`);
}
function replaceMethod(src, name, replacement) {
  const { start, end } = findMethodRange(src, name);
  return src.slice(0, start) + replacement.trimEnd() + src.slice(end);
}
function insertBeforeMethod(src, name, block) {
  const { start } = findMethodRange(src, name);
  return src.slice(0, start) + block.trimEnd() + '\n\n' + src.slice(start);
}
function hasMethod(src, name) {
  try { findMethodRange(src, name); return true; } catch { return false; }
}

const rulesSource = fs.readFileSync(path.join(scriptDir, 'content-rules-source.js'), 'utf8');
write('js/content-rules.js', rulesSource);
console.log('[OK] js/content-rules.js');

const EngineMethods = class {
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
    const intervalMs = 100;

    this.reactionTimer = setInterval(() => {
      this.reactionSecondsLeft = Math.max(0, this.reactionSecondsLeft - 0.1);
      if (this.onTimerTick) this.onTimerTick(this.reactionSecondsLeft, this.reactionMaxSeconds);
      this.notifyState();
      if (this.reactionSecondsLeft <= 0) {
        this.clearReactionTimer();
        this.resolveUnansweredAttack();
      }
    }, intervalMs);
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

      if (this.beamClashData.p1Progress <= 0) this.resolveBeamClashWinner('opponent');
      else if (this.beamClashData.p1Progress >= 100) this.resolveBeamClashWinner('player');
      else if (this.beamClashData.timer <= 0) {
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

  executeAiTurn() {
    if (this.state === 'FREE_ACTION' && this.initiative === 'opponent') {
      const playable = this.opponent.hand.findIndex(card => {
        if (!card || (!isAttackAction(card) && !isImmediateTechnique(card))) return false;
        return this.getCardCost('opponent', card) <= this.opponent.ki;
      });

      if (playable !== -1) this.playCard('opponent', playable);
      else if (this.opponent.ki < 10) this.chargeKi('opponent');
      else this.passTurn('opponent');
      return;
    }

    if (this.state === 'ATTACK_PENDING' && this.pendingAttack?.attackerKey === 'player') {
      const defIdx = this.opponent.hand.findIndex(card => {
        if (!card || this.getCardCost('opponent', card) > this.opponent.ki) return false;
        return this.isReactionCardLegal('opponent', card, this.pendingAttack.card);
      });

      if (defIdx !== -1) {
        this.playCard('opponent', defIdx);
      } else {
        setTimeout(() => {
          if (this.state === 'ATTACK_PENDING' && this.pendingAttack?.attackerKey === 'player') {
            this.clearReactionTimer();
            this.resolveUnansweredAttack();
          }
        }, 1000);
      }
    }
  }
};

const ServerMethods = class {
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
      player: pack(this.player, viewerKey === 'player'),
      opponent: pack(this.opponent, viewerKey === 'opponent')
    };
  }
};

const ClientMethods = class {
  applyFullSyncState(data) {
    if (!data || this.isAiMatch) return;

    const oldState = this.state;
    this.state = data.state;
    this.initiative = data.initiative;
    this.winner = data.winner || null;
    this.pendingAttack = data.pendingAttack || null;
    this.beamClashData = data.beamClashData || null;
    this.reactionSecondsLeft = Number(data.reactionSecondsLeft ?? 0);
    this.reactionMaxSeconds = Number(data.reactionMaxSeconds ?? 3.0);

    const applyFighter = (target, source) => {
      if (!source) return;
      target.name = source.name || target.name;
      target.hp = source.hp;
      target.maxHp = source.maxHp;
      target.ki = source.ki;
      target.shields = source.shields;
      target.isAwakened = !!source.isAwakened;
      target.isOpenGuard = !!source.isOpenGuard;
      target.nextAttackBonus = Number(source.nextAttackBonus || 0);
      target.hand = Array.isArray(source.hand) ? source.hand : [];
      target.discard = Array.isArray(source.discard) ? source.discard : [];
      target.deck = Array.from({ length: Number(source.deckCount || 0) }, () => '__hidden__');
      if (source.leader) target.leader = source.leader;
    };

    applyFighter(this.player, data.player);
    applyFighter(this.opponent, data.opponent);

    if (oldState !== 'BEAM_CLASH' && this.state === 'BEAM_CLASH') {
      this.log('DISPUTA DE BEAM!', 'info');
    }
    if (this.state === 'ATTACK_PENDING' && this.onTimerTick) {
      this.onTimerTick(this.reactionSecondsLeft, this.reactionMaxSeconds);
    }
    if (this.state === 'GAME_OVER') this.checkGameOver();
    this.notifyState();
  }
};

const UIReplacement = class {
  renderPlayerHand(hand, playerKi, gameState, initiative, pendingAttack, isOpenGuard) {
    if (!this.p1HandContainer) return;

    const awakened = !!this.gameEngine?.player?.isAwakened;
    const buff = Number(this.gameEngine?.player?.nextAttackBonus || 0);
    const renderHash = (hand || []).map(c => c.id).join(',') + `|${playerKi}|${gameState}|${initiative}|${isOpenGuard}|${awakened}|${buff}`;
    if (this.p1HandContainer.dataset.renderHash === renderHash) return;
    this.p1HandContainer.dataset.renderHash = renderHash;
    this.p1HandContainer.innerHTML = '';

    hand.forEach((card, index) => {
      if (!card || card.hidden) return;
      const el = document.createElement('div');
      const effectiveCost = this.gameEngine.getCardCost('player', card);
      let isPlayable = false;
      let reasonText = '';

      if (playerKi < effectiveCost) {
        reasonText = i18n.t('reasonNeedKi');
      } else if (gameState === 'FREE_ACTION' && initiative === 'player') {
        if (card.type === 'attack' || card.type === 'tech') isPlayable = true;
        else reasonText = i18n.t('reasonDefenseOnly');
      } else if (gameState === 'ATTACK_PENDING' && pendingAttack) {
        if (pendingAttack.attackerKey === 'opponent') {
          if (this.gameEngine.isReactionCardLegal('player', card, pendingAttack.card)) isPlayable = true;
          else reasonText = card.type === 'evade' && isOpenGuard ? i18n.t('reasonOpenGuard') : i18n.t('reasonReactionOnly');
        } else {
          reasonText = i18n.t('reasonInFlight');
        }
      } else if (initiative !== 'player') {
        reasonText = i18n.t('reasonOpponentTurn');
      }

      el.className = `card type-${card.type}${card.rarity === 'super-rare' ? ' super-rare' : ''} ${isPlayable ? 'playable' : 'unplayable'}`;
      el.title = isPlayable ? '' : reasonText;
      el.innerHTML = `
        ${assetLoader.renderCardArtHTML(card)}
        <div class="card-header"><div class="card-ki-cost">${effectiveCost}</div></div>
        <div class="card-type-tag tag-${card.type}">${card.type.toUpperCase()}</div>
        ${card.power > 0 ? `<div class="card-power-badge">${card.power} ATK</div>` : ''}
      `;

      el.draggable = isPlayable;
      el.addEventListener('dragstart', () => { this.draggedCardIndex = index; });
      el.addEventListener('touchstart', () => {
        if (isPlayable) this.draggedCardIndex = index;
        el.classList.add('touch-hover');
      }, { passive: true });
      el.addEventListener('touchmove', e => {
        if (e.touches?.[0]) {
          const touch = e.touches[0];
          const targetEl = document.elementFromPoint(touch.clientX, touch.clientY);
          const parentCard = targetEl ? targetEl.closest('.card') : null;
          this.p1HandContainer.querySelectorAll('.card').forEach(c => c.classList.toggle('touch-hover', c === parentCard));
        }
      }, { passive: true });
      const clearTouchHover = () => this.p1HandContainer.querySelectorAll('.card').forEach(c => c.classList.remove('touch-hover'));
      el.addEventListener('touchend', clearTouchHover);
      el.addEventListener('touchcancel', clearTouchHover);
      el.addEventListener('click', () => {
        if (isPlayable) {
          soundEngine.playClick();
          soundEngine.playCardPlay();
          this.gameEngine.playCard('player', index);
        }
      });
      this.p1HandContainer.appendChild(el);
    });
  }
};

function addRulesImport(src, rel) {
  if (src.includes('content-rules.js')) return src;
  const spec = rel === 'server/server-engine.js' ? '../js/content-rules.js' : './content-rules.js';
  const anchor = rel === 'server/server-engine.js'
    ? "import { LEADERS, getCardById, getStarterDeckForLeader } from '../js/card-database.js';"
    : "import { LEADERS, getCardById, getStarterDeckForLeader } from './card-database.js';";
  const addition = `\nimport { getCardRule, isAttackAction, isImmediateTechnique, getEffectiveCardCost, getLeaderAttackBonus, getChargeAmount, getOpenGuardDurationMs, getBeamMashPower, getReactionSeconds, getDefenseBlockMultiplier, canUseReaction } from '${spec}';`;
  if (!src.includes(anchor)) throw new Error(`Import anchor nao encontrado em ${rel}`);
  return src.replace(anchor, anchor + addition);
}

function patchEngine(rel, isServer) {
  backup(rel);
  let src = addRulesImport(read(rel), rel);

  const replacements = [
    'reset', 'hasDefensiveResponse', '_chargeKi', '_playCard', 'startReactionTimer',
    'resolveUnansweredAttack', 'resolveReaction', 'startBeamClashLoop', '_mashBeamClash',
    'resolveBeamClashWinner', 'checkAwaken', 'executeAiTurn'
  ];
  for (const name of replacements) src = replaceMethod(src, name, methodSource(EngineMethods.prototype[name]));

  const helperNames = [
    'getCardCost', 'isReactionCardLegal', '_otherKey', '_fighter', '_healFighter',
    '_applyDirectDamage', '_runtimeAttackCard', '_forceShieldBreakDamage',
    '_applyAttackPostHit', '_finishAttack', '_resolveTechnique', '_applyDefenseExtras',
    '_applyEvadeExtras', '_applyCounterExtras'
  ];
  const missingHelpers = helperNames.filter(name => !hasMethod(src, name));
  if (missingHelpers.length) {
    const block = missingHelpers.map(name => methodSource(EngineMethods.prototype[name])).join('\n\n');
    src = insertBeforeMethod(src, 'hasDefensiveResponse', block);
  }

  if (isServer) src = replaceMethod(src, 'getFullSyncState', methodSource(ServerMethods.prototype.getFullSyncState));
  else src = replaceMethod(src, 'applyFullSyncState', methodSource(ClientMethods.prototype.applyFullSyncState));

  write(rel, src);
  console.log(`[OK] ${rel}`);
}

for (const rel of ['server/server-engine.js', 'js/game-engine.js', 'js/card-database.js', 'js/ui-manager.js', 'package.json']) {
  if (!fs.existsSync(path.join(root, rel))) throw new Error(`Arquivo obrigatorio ausente: ${rel}`);
}
if (!fs.existsSync(path.join(root, 'scripts/test-release-core.mjs'))) {
  throw new Error('Release Fix 01 nao detectado. Rode/valide o Fix 01 antes do Fix 02.');
}

patchEngine('server/server-engine.js', true);
patchEngine('js/game-engine.js', false);

backup('js/card-database.js');
let db = read('js/card-database.js');
db = db.replace(
  "return CARD_DATABASE.find(c => c.id === cardId) || CARD_DATABASE[0];",
  "return CARD_DATABASE.find(c => c.id === cardId) || null;"
);
write('js/card-database.js', db);
console.log('[OK] js/card-database.js');

backup('js/ui-manager.js');
let ui = read('js/ui-manager.js');
ui = replaceMethod(ui, 'renderPlayerHand', methodSource(UIReplacement.prototype.renderPlayerHand));
ui = ui.replace(
  "this.triggerActionBanner('CARREGAR KI (+2 KI)', 'act-charge', '気力充填');",
  "this.triggerActionBanner(`CARREGAR KI (+${data.amount || 2} KI)`, 'act-charge', '気力充填');"
);
write('js/ui-manager.js', ui);
console.log('[OK] js/ui-manager.js');

backup('package.json');
const pkg = JSON.parse(read('package.json'));
pkg.scripts ||= {};
pkg.scripts['test:content'] = 'node scripts/test-release-content.mjs';
pkg.scripts.test = 'npm run test:core && npm run test:content';
pkg.scripts.check = 'node --check server.js && node --check server/server-engine.js && node --check js/game-engine.js && node --check js/content-rules.js && node --check js/ui-manager.js && npm test';
write('package.json', JSON.stringify(pkg, null, 2) + '\n');
console.log('[OK] package.json');

write('scripts/test-release-content.mjs', `import assert from 'node:assert/strict';
import { GameEngine } from '../server/server-engine.js';
import { CARD_DATABASE, LEADERS, getCardById } from '../js/card-database.js';
import { SPECIAL_RULE_IDS, getEffectiveCardCost, getBeamMashPower, getChargeAmount } from '../js/content-rules.js';

function makeEngine() {
  const e = new GameEngine(() => {}, () => {});
  e.startMatch('goku', 'vegeta', [], false);
  e.clearReactionTimer();
  e.clearBeamClashLoop();
  e.state = 'FREE_ACTION';
  e.initiative = 'player';
  return e;
}
function card(id) {
  const c = getCardById(id);
  assert.ok(c, 'Carta ausente: ' + id);
  return { ...c, instanceId: id + '_test' };
}
let passed = 0;
function test(name, fn) {
  try { fn(); console.log('PASS', name); passed++; }
  catch (err) { console.error('FAIL', name); throw err; }
}

test('banco contem exatamente 70 cartas nas cinco categorias', () => {
  assert.equal(CARD_DATABASE.length, 70);
  const counts = CARD_DATABASE.reduce((acc, c) => { acc[c.type] = (acc[c.type] || 0) + 1; return acc; }, {});
  assert.equal(counts.attack, 28);
  assert.equal(counts.defense, 15);
  assert.equal(counts.evade, 9);
  assert.equal(counts.counter, 9);
  assert.equal(counts.tech, 9);
});

test('IDs invalidos nao viram Meteor Combination', () => {
  assert.equal(getCardById('__invalid__'), null);
});

test('todos os IDs especiais declarados existem no banco', () => {
  for (const id of SPECIAL_RULE_IDS) assert.ok(getCardById(id), id);
});

test('Goku reduz Combo em 1 Ki e Ki/Tech em 2 ao despertar', () => {
  const fighter = { leader: LEADERS.goku, isAwakened: false };
  assert.equal(getEffectiveCardCost(fighter, getCardById('atk_01')), 1);
  fighter.isAwakened = true;
  assert.equal(getEffectiveCardCost(fighter, getCardById('atk_02')), 2);
  assert.equal(getEffectiveCardCost(fighter, getCardById('tch_02')), 0);
});

test('Trunks reduz Esquiva em 1 Ki', () => {
  assert.equal(getEffectiveCardCost({ leader: LEADERS.trunks, isAwakened: false }, getCardById('evd_08')), 1);
});

test('Frieza suprime carga inimiga e desperto carrega 3', () => {
  assert.equal(getChargeAmount({ leader: LEADERS.goku, isAwakened: false }, { leader: LEADERS.frieza, isAwakened: false }), 1);
  assert.equal(getChargeAmount({ leader: LEADERS.frieza, isAwakened: true }, { leader: LEADERS.goku, isAwakened: false }), 3);
});

test('Gohan desperto tem mash aumentado em aproximadamente 50%', () => {
  assert.equal(getBeamMashPower({ leader: LEADERS.gohan, isAwakened: true }), 11);
});

test('Piccolo cura 50 HP ao despertar', () => {
  const e = makeEngine();
  e.player.leader = { ...LEADERS.piccolo };
  e.player.hp = 190;
  e.player.shields = 4;
  assert.equal(e.checkAwaken(e.player), true);
  assert.equal(e.player.isAwakened, true);
  assert.equal(e.player.hp, 240);
  e.reset();
});

test('Vegeta recebe +10 com 3 ataques na mao', () => {
  const e = makeEngine();
  e.player.leader = { ...LEADERS.vegeta };
  e.player.ki = 10;
  e.player.hand = [card('atk_20'), card('atk_21'), card('atk_26')];
  assert.equal(e._playCard('player', 0), true);
  assert.equal(e.pendingAttack.card.resolvedPower, 25);
  e.clearReactionTimer(); e.reset();
});

test('todas as 28 cartas de ataque entram em ATTACK_PENDING sem estado invalido', () => {
  for (const original of CARD_DATABASE.filter(c => c.type === 'attack')) {
    const e = makeEngine();
    e.player.ki = 10;
    e.player.hand = [{ ...original, instanceId: 'x' }];
    assert.equal(e._playCard('player', 0), true, original.id);
    assert.equal(e.state, 'ATTACK_PENDING', original.id);
    assert.equal(e.player.hand.length, 0, original.id);
    assert.ok(e.player.ki >= 0 && e.player.ki <= 10, original.id);
    e.clearReactionTimer(); e.reset();
  }
});

test('as 8 tecnicas instantaneas resolvem sem criar ataque fantasma', () => {
  for (const original of CARD_DATABASE.filter(c => c.type === 'tech' && c.id !== 'tch_03')) {
    const e = makeEngine();
    e.player.hp = 300;
    e.player.shields = 6;
    e.player.ki = 10;
    e.player.hand = [{ ...original, instanceId: 'x' }];
    assert.equal(e._playCard('player', 0), true, original.id);
    assert.notEqual(e.state, 'ATTACK_PENDING', original.id);
    assert.equal(e.pendingAttack, null, original.id);
    assert.ok(e.player.hp >= 0 && e.player.hp <= e.player.maxHp, original.id);
    assert.ok(e.player.ki >= 0 && e.player.ki <= 10, original.id);
    e.reset();
  }
});

test('Spirit Bomb Charge e ataque real de 90 com janela maior', () => {
  const e = makeEngine();
  e.player.ki = 10;
  e.player.hand = [card('tch_03')];
  assert.equal(e._playCard('player', 0), true);
  assert.equal(e.state, 'ATTACK_PENDING');
  assert.equal(e.pendingAttack.card.resolvedPower, 90);
  assert.equal(e.reactionMaxSeconds, 4);
  e.clearReactionTimer(); e.reset();
});

test('Saiyan Pride aplica +25 somente ao proximo ataque', () => {
  const e = makeEngine();
  e.player.ki = 10;
  e.player.hand = [card('tch_04')];
  e._playCard('player', 0);
  assert.equal(e.player.nextAttackBonus, 25);
  e.state = 'FREE_ACTION'; e.initiative = 'player'; e.player.ki = 10;
  e.player.hand = [card('atk_20')];
  e._playCard('player', 0);
  assert.equal(e.pendingAttack.card.resolvedPower, 40);
  assert.equal(e.player.nextAttackBonus, 0);
  e.clearReactionTimer(); e.reset();
});

test('Hellzone Grenade rejeita Defesa Azul sem consumir carta', () => {
  const e = makeEngine();
  e.state = 'ATTACK_PENDING';
  e.pendingAttack = { attackerKey: 'player', card: card('atk_12') };
  e.opponent.ki = 10;
  e.opponent.hand = [card('def_01')];
  assert.equal(e._playCard('opponent', 0), false);
  assert.equal(e.opponent.hand.length, 1);
  e.reset();
});

test('Dragon Fist perfura 50% e Special Beam Cannon 100% da defesa', () => {
  let e = makeEngine();
  e.state = 'ATTACK_PENDING'; e.pendingAttack = { attackerKey: 'player', card: { ...card('atk_04'), resolvedPower: 30 } };
  e.opponent.ki = 10; e.opponent.hand = [card('def_01')];
  e._playCard('opponent', 0);
  assert.equal(e.opponent.hp, 382); // block 12, damage 18
  e.reset();

  e = makeEngine();
  e.state = 'ATTACK_PENDING'; e.pendingAttack = { attackerKey: 'player', card: { ...card('atk_05'), resolvedPower: 55 } };
  e.opponent.ki = 10; e.opponent.hand = [card('def_11')];
  e._playCard('opponent', 0);
  assert.equal(e.opponent.hp, 345);
  e.reset();
});

test('Destructo Disc sempre quebra ao menos um segmento de escudo', () => {
  const e = makeEngine();
  e.state = 'ATTACK_PENDING'; e.pendingAttack = { attackerKey: 'player', card: { ...card('atk_15'), resolvedPower: 36 } };
  e.opponent.hp = 400; e.opponent.shields = 8;
  e.resolveUnansweredAttack();
  assert.ok(e.opponent.hp <= 350);
  assert.ok(e.opponent.shields <= 7);
  e.reset();
});

test('Death Ball drena Ki e Scatter Shot queima uma defesa ao acertar', () => {
  let e = makeEngine();
  e.state = 'ATTACK_PENDING'; e.pendingAttack = { attackerKey: 'player', card: { ...card('atk_18'), resolvedPower: 62 } };
  e.opponent.ki = 5; e.resolveUnansweredAttack();
  assert.equal(e.opponent.ki, 5); // drenou 1 e recebeu +1 no inicio da nova iniciativa
  e.reset();

  e = makeEngine();
  e.state = 'ATTACK_PENDING'; e.pendingAttack = { attackerKey: 'player', card: { ...card('atk_22'), resolvedPower: 28 } };
  e.opponent.hand = [card('def_01'), card('evd_08')];
  e.opponent.deck = ['evd_08'];
  e.resolveUnansweredAttack();
  assert.equal(e.opponent.hand.some(c => c.id === 'def_01'), false);
  assert.equal(e.opponent.discard.includes('def_01'), true);
  e.reset();
});

test('todas as 15 defesas resolvem como resposta valida', () => {
  for (const original of CARD_DATABASE.filter(c => c.type === 'defense')) {
    const e = makeEngine();
    e.state = 'ATTACK_PENDING';
    e.pendingAttack = { attackerKey: 'player', card: { ...card('atk_03'), resolvedPower: 65 } };
    e.opponent.ki = 10;
    e.opponent.hand = [{ ...original, instanceId: 'x' }];
    assert.equal(e._playCard('opponent', 0), true, original.id);
    assert.notEqual(e.state, 'ATTACK_PENDING', original.id);
    e.reset();
  }
});

test('Full Power Deflect reflete 10 HP', () => {
  const e = makeEngine();
  e.state = 'ATTACK_PENDING'; e.pendingAttack = { attackerKey: 'player', card: { ...card('atk_03'), resolvedPower: 65 } };
  e.opponent.ki = 10; e.opponent.hand = [card('def_07')];
  e._playCard('opponent', 0);
  assert.equal(e.player.hp, 390);
  e.reset();
});

test('todas as 9 esquivas resolvem; Afterimage exige golpe fisico', () => {
  for (const original of CARD_DATABASE.filter(c => c.type === 'evade')) {
    const e = makeEngine();
    const atk = original.id === 'evd_02' ? card('atk_01') : card('atk_03');
    e.state = 'ATTACK_PENDING'; e.pendingAttack = { attackerKey: 'player', card: { ...atk, resolvedPower: atk.power } };
    e.opponent.ki = 10; e.opponent.hand = [{ ...original, instanceId: 'x' }];
    assert.equal(e._playCard('opponent', 0), true, original.id);
    e.reset();
  }
  const e = makeEngine();
  e.state = 'ATTACK_PENDING'; e.pendingAttack = { attackerKey: 'player', card: { ...card('atk_03'), resolvedPower: 65 } };
  e.opponent.ki = 10; e.opponent.hand = [card('evd_02')];
  assert.equal(e._playCard('opponent', 0), false);
  e.reset();
});

test('todas as 9 counters resolvem e aplicam dano quando descrito', () => {
  for (const original of CARD_DATABASE.filter(c => c.type === 'counter')) {
    const e = makeEngine();
    const atk = original.id === 'ctr_08' ? card('atk_01') : card('atk_03');
    e.state = 'ATTACK_PENDING'; e.pendingAttack = { attackerKey: 'player', card: { ...atk, resolvedPower: atk.power } };
    e.opponent.ki = 10; e.opponent.hand = [{ ...original, instanceId: 'x' }];
    const before = e.player.hp;
    assert.equal(e._playCard('opponent', 0), true, original.id);
    if (original.power > 0) assert.equal(e.player.hp, before - original.power, original.id);
    e.reset();
  }
});

test('Ki Blast Deflection so responde Beam e Emperor Finger Snap so fisico', () => {
  let e = makeEngine();
  e.state = 'ATTACK_PENDING'; e.pendingAttack = { attackerKey: 'player', card: card('atk_01') };
  e.opponent.ki = 10; e.opponent.hand = [card('ctr_04')];
  assert.equal(e._playCard('opponent', 0), false);
  e.reset();

  e = makeEngine();
  e.state = 'ATTACK_PENDING'; e.pendingAttack = { attackerKey: 'player', card: card('atk_03') };
  e.opponent.ki = 10; e.opponent.hand = [card('ctr_08')];
  assert.equal(e._playCard('opponent', 0), false);
  e.reset();
});

test('Piccolo desperto perfura 100% de defesa com ataque de Ki', () => {
  const e = makeEngine();
  e.player.leader = { ...LEADERS.piccolo };
  e.player.isAwakened = true;
  e.state = 'ATTACK_PENDING'; e.pendingAttack = { attackerKey: 'player', card: { ...card('atk_02'), resolvedPower: 40 } };
  e.opponent.ki = 10; e.opponent.hand = [card('def_11')];
  e._playCard('opponent', 0);
  assert.equal(e.opponent.hp, 360);
  e.reset();
});

test('Beam Clash usa o poder real do feixe vencedor', () => {
  const e = makeEngine();
  e.state = 'ATTACK_PENDING';
  e.pendingAttack = { attackerKey: 'player', card: { ...card('atk_02'), resolvedPower: 40 } };
  assert.equal(e.startBeamClashLoop({ ...card('atk_03'), resolvedPower: 65 }), true);
  e.clearBeamClashLoop();
  assert.equal(e.resolveBeamClashWinner('opponent'), true);
  assert.equal(e.player.hp, 335);
  e.reset();
});

console.log('\nCONTENT RELEASE TESTS: ' + passed + ' PASS / 0 FAIL');
`);
console.log('[OK] scripts/test-release-content.mjs');
console.log('\nPATCH RELEASE FIX 02 APLICADO.');
