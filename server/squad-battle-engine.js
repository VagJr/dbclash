import crypto from 'node:crypto';
import { LEADERS, getCardById } from '../js/card-database.js';
import {
  canUseReaction,
  getBeamMashPower,
  getCardRule,
  getEffectiveCardCost,
  getLeaderAttackBonus,
  getChargeAmount,
  getDefenseBlockMultiplier,
  getReactionSeconds,
  isAttackAction,
  isImmediateTechnique
} from '../js/content-rules.js';

export const SQUAD_ACTION_COOLDOWN_MS = 1800;
export const SQUAD_FAST_COOLDOWN_MS = 700;
export const SQUAD_BEAM_CLASH_MS = 4200;
export const SQUAD_PRESENTATION_MS = 1500;
export const SQUAD_MASH_THROTTLE_MS = 80;

function shuffleSecure(list) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}

function publicCard(card) {
  if (!card) return null;
  return {
    id: card.id,
    name: card.name,
    type: card.type,
    cost: Number(card.cost || 0),
    power: Number(card.power || 0),
    resolvedPower: Number(card.resolvedPower ?? card.power ?? 0),
    damageKind: card.damageKind || (card.isBeam ? 'beam' : card.isCombo ? 'physical' : 'ki'),
    block: Number(card.block || 0),
    rarity: card.rarity || 'common',
    isBeam: !!card.isBeam,
    isCombo: !!card.isCombo
  };
}

export class SquadBattleEngine {
  constructor({ teamA = [], teamB = [], onState = () => {}, onFx = () => {}, onComplete = () => {} } = {}) {
    if (teamA.length !== 2 || teamB.length !== 2) {
      throw new Error('SquadBattleEngine requires exactly 2 players per team.');
    }

    this.onState = onState;
    this.onFx = onFx;
    this.onComplete = onComplete;

    this.state = 'ACTIVE';
    this.finished = false;
    this.teamWinner = null;
    this.stateVersion = 0;
    this.presentationSeq = 0;
    this.startedAt = Date.now();
    this.logs = [];

    this.pendingAttacks = new Map(); // targetUid -> pending attack
    this.beamClashes = new Map();    // clashId -> clash
    this.pendingTimers = new Map();  // pendingId -> timeout
    this.clashTimers = new Map();    // clashId -> timeout
    this.lastMashAt = new Map();     // clashId:uid -> timestamp
    this.lastResolved = null;

    this.teams = {
      A: teamA.map(entry => this._makeFighter(entry, 'A')),
      B: teamB.map(entry => this._makeFighter(entry, 'B'))
    };

    for (const member of [...this.teams.A, ...this.teams.B]) this.draw(member, 5);
    this._log('Batalha 2v2 simultanea iniciada.', 'info');
  }

  _makeFighter(entry, side) {
    const leader = LEADERS[entry.leader] || LEADERS.goku;
    return {
      uid: entry.uid,
      username: entry.username || 'Guerreiro Z',
      side,
      leader: { ...leader },
      isBot: !!entry.isBot,
      botDifficulty: entry.botDifficulty || 'normal',
      hp: leader.maxHp || 400,
      maxHp: leader.maxHp || 400,
      ki: leader.id === 'frieza' ? 6 : 4,
      isAwakened: false,
      nextAttackBonus: 0,
      openGuardUntil: 0,
      get isOpenGuard() { return this.openGuardUntil > Date.now(); },
      downed: false,
      abandoned: false,
      hand: [],
      deck: shuffleSecure(entry.deck || []),
      discard: [],
      actionReadyAt: Date.now() + 500
    };
  }

  _log(text, type = 'info') {
    this.logs.unshift({
      text,
      type,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });
    if (this.logs.length > 60) this.logs.length = 60;
  }

  _notify() {
    this.stateVersion += 1;
    this.onState(this);
  }

  _emit(type, data = {}) {
    this.presentationSeq += 1;
    this.onFx(type, {
      ...data,
      presentationSeq: this.presentationSeq,
      serverAt: Date.now()
    });
  }

  dispose() {
    for (const timer of this.pendingTimers.values()) clearTimeout(timer);
    for (const timer of this.clashTimers.values()) clearTimeout(timer);
    this.pendingTimers.clear();
    this.clashTimers.clear();
    this.pendingAttacks.clear();
    this.beamClashes.clear();
    this.lastMashAt.clear();
  }

  _complete(winnerSide) {
    if (this.finished) return;
    this.finished = true;
    this.state = 'GAME_OVER';
    this.teamWinner = winnerSide;
    this.dispose();
    this._log(`Time ${winnerSide} venceu a batalha 2v2.`, 'result');
    this._notify();
    this.onComplete(winnerSide, this);
  }

  getMember(uid) {
    for (const side of ['A', 'B']) {
      const member = this.teams[side].find(item => item.uid === uid);
      if (member) return { side, member };
    }
    return null;
  }

  getTeam(side) {
    return this.teams[side] || [];
  }

  getAlive(side) {
    return this.getTeam(side).filter(member =>
      !member.downed && !member.abandoned && member.hp > 0
    );
  }

  getEnemies(uid) {
    const found = this.getMember(uid);
    if (!found) return [];
    return this.getAlive(found.side === 'A' ? 'B' : 'A');
  }

  getAllies(uid) {
    const found = this.getMember(uid);
    if (!found) return [];
    return this.getAlive(found.side);
  }

  getPendingFor(uid) {
    return this.pendingAttacks.get(uid) || null;
  }

  getClashFor(uid) {
    for (const clash of this.beamClashes.values()) {
      if (clash.attackerUid === uid || clash.responderUid === uid) return clash;
    }
    return null;
  }

  canAct(uid, now = Date.now()) {
    if (this.finished || this.state !== 'ACTIVE') return false;
    const found = this.getMember(uid);
    const player = found?.member;
    if (!player || player.downed || player.abandoned || player.hp <= 0) return false;
    if (this.getPendingFor(uid)) return false;
    if (this.getClashFor(uid)) return false;
    if ([...this.pendingAttacks.values()].some(attack => attack.attackerUid === uid)) return false;
    return now >= (player.actionReadyAt || 0);
  }

  canReact(uid) {
    if (this.finished || this.state !== 'ACTIVE') return false;
    const player = this.getMember(uid)?.member;
    return !!player &&
      !player.downed &&
      !player.abandoned &&
      player.hp > 0 &&
      !!this.getPendingFor(uid) &&
      Date.now() < this.getPendingFor(uid).deadline &&
      !this.getClashFor(uid);
  }

  draw(player, count = 1) {
    for (let i = 0; i < count; i++) {
      if (!player || player.hand.length >= 7) break;
      if (!player.deck.length) {
        if (!player.discard.length) break;
        player.deck = shuffleSecure(player.discard);
        player.discard = [];
      }
      const cardId = player.deck.pop();
      const card = getCardById(cardId);
      if (card) {
        player.hand.push({
          ...card,
          instanceId: `${card.id}_${crypto.randomUUID()}`
        });
      }
    }
  }

  _awakenIfNeeded(player) {
    if (!player || player.isAwakened || player.hp <= 0) return;
    if (player.hp <= (player.leader.awakenThresholdHp || 200)) {
      player.isAwakened = true;
      if (player.leader.id === 'piccolo') {
        player.hp = Math.min(player.maxHp, player.hp + 50);
      }
      this._log(
        `${player.username} despertou ${player.leader.awakenedName || 'Poder Total'}.`,
        'awaken'
      );
    }
  }

  _setCooldown(player, card = null) {
    const rule = card ? getCardRule(card) : {};
    const ms = rule.retainInitiative
      ? SQUAD_FAST_COOLDOWN_MS
      : SQUAD_ACTION_COOLDOWN_MS;
    player.actionReadyAt = Date.now() + ms;
  }

  _consumeCard(player, index, card, cost) {
    player.ki -= cost;
    player.hand.splice(index, 1);
    player.discard.push(card.id);
  }

  _applyImmediateTechnique(player, card) {
    const rule = getCardRule(card);

    if (rule.selfDamage) {
      player.hp = Math.max(0, player.hp - rule.selfDamage);
      if (player.hp <= 0) player.downed = true;
    }
    if (rule.heal && player.hp > 0) player.hp = Math.min(player.maxHp, player.hp + rule.heal);
    if (rule.kiGain) player.ki = Math.min(10, player.ki + rule.kiGain);
    if (rule.draw) this.draw(player, rule.draw);
    if (rule.nextAttackBonus) player.nextAttackBonus = Math.max(player.nextAttackBonus || 0, rule.nextAttackBonus);

    this._awakenIfNeeded(player);
  }

  _applyReactionExtras(player, card) {
    if (player.hp <= 0) return;
    const rule = getCardRule(card);
    if (rule.heal) player.hp = Math.min(player.maxHp, player.hp + rule.heal);
    if (rule.kiGain) player.ki = Math.min(10, player.ki + rule.kiGain);
    if (rule.draw) this.draw(player, rule.draw);
  }

  _attackDamage(attacker, card, handBefore) {
    let damage =
      Math.max(0, Number(card.power) || 0) +
      getLeaderAttackBonus(attacker, card, handBefore) +
      Math.max(0, Number(attacker.nextAttackBonus) || 0);

    attacker.nextAttackBonus = 0;
    return Math.max(0, Math.floor(damage));
  }

  _schedulePending(pending) {
    const wait = Math.max(1, pending.deadline - Date.now());
    const timer = setTimeout(() => {
      this.pendingTimers.delete(pending.id);
      this._resolvePendingAttack(pending.targetUid, pending.id, null);
    }, wait);
    timer.unref?.();
    this.pendingTimers.set(pending.id, timer);
  }

  _clearPendingTimer(pendingId) {
    const timer = this.pendingTimers.get(pendingId);
    if (timer) clearTimeout(timer);
    this.pendingTimers.delete(pendingId);
  }

  _createPendingAttack(attacker, target, card, damage) {
    const pending = {
      id: `pending_${crypto.randomUUID()}`,
      attackerUid: attacker.uid,
      targetUid: target.uid,
      card: publicCard(card),
      damage,
      response: null,
      createdAt: Date.now(),
      deadline: Date.now() + Math.max(900, getReactionSeconds(card) * 1000)
    };

    this.pendingAttacks.set(target.uid, pending);
    this._schedulePending(pending);

    this._log(
      `${attacker.username} lancou ${card.name} contra ${target.username}.`,
      'attack'
    );

    this._emit('squad_card_played', {
      pendingId: pending.id,
      attackerUid: attacker.uid,
      targetUid: target.uid,
      card: pending.card,
      deadline: pending.deadline
    });

    return pending;
  }

  _setLastResolved(payload) {
    this.lastResolved = {
      ...payload,
      resolvedAt: Date.now(),
      expiresAt: Date.now() + SQUAD_PRESENTATION_MS
    };
  }

  _applyDamage(player, damage, source = null) {
    const finalDamage = Math.max(0, Math.floor(Number(damage) || 0));
    const previousHp = player.hp;
    player.hp = Math.max(0, player.hp - finalDamage);
    const dealt = previousHp - player.hp;
    if (dealt > 0 && player.leader?.id === 'goku') player.ki = Math.min(10, player.ki + 1);
    if (source?.leader?.id === 'gohan' && Math.ceil(player.hp / 50) < Math.ceil(previousHp / 50)) this.draw(source, 2);

    if (player.hp <= 0) {
      player.downed = true;
      this._log(`${player.username} foi nocauteado.`, 'ko');
      this._cancelIncomingTo(player.uid);
    } else {
      this._awakenIfNeeded(player);
    }
    return dealt;
  }

  _attackPostHit(attacker, target, card, dealt) {
    if (dealt <= 0) return;
    const rule = getCardRule(card);
    if (rule.drainKi) target.ki = Math.max(0, target.ki - rule.drainKi);
    for (let count = 0; count < Number(rule.burnDefense || 0); count++) {
      const index = target.hand.findIndex(item => item.type === 'defense');
      if (index < 0) break;
      target.discard.push(target.hand.splice(index, 1)[0].id);
    }
  }

  _effectiveAttackDamage(target, card, damage) {
    let amount = target.isOpenGuard ? Math.floor(damage * 1.5) : damage;
    if (getCardRule(card).breakShield && target.hp > 0) amount = Math.max(amount, target.hp - Math.max(0, (Math.ceil(target.hp / 50) - 1) * 50));
    return amount;
  }

  _cancelIncomingTo(uid) {
    for (const [targetUid, pending] of this.pendingAttacks) {
      if (targetUid !== uid && pending.attackerUid !== uid) continue;
      this._clearPendingTimer(pending.id);
      this.pendingAttacks.delete(targetUid);
    }

    for (const [id, clash] of this.beamClashes.entries()) {
      if (clash.attackerUid === uid || clash.responderUid === uid) {
        const timer = this.clashTimers.get(id);
        if (timer) clearTimeout(timer);
        this.clashTimers.delete(id);
        this.beamClashes.delete(id);
      }
    }
  }

  _resolvePendingAttack(targetUid, pendingId, reaction = null) {
    if (this.finished) return false;
    const pending = this.pendingAttacks.get(targetUid);
    if (!pending || pending.id !== pendingId) return false;
    if ([...this.beamClashes.values()].some(clash => clash.pendingId === pendingId)) return false;

    const attacker = this.getMember(pending.attackerUid)?.member;
    const target = this.getMember(pending.targetUid)?.member;
    if (!attacker || !target) {
      this.pendingAttacks.delete(targetUid);
      return false;
    }

    this._clearPendingTimer(pendingId);

    let damage = target.isOpenGuard ? Math.floor(pending.damage * 1.5) : pending.damage;
    let counterDamage = 0;
    const responseCard = reaction?.card || null;

    if (responseCard) {
      const rule = getCardRule(responseCard);

      if (responseCard.type === 'evade') {
        damage = 0;
      } else if (responseCard.type === 'counter') {
        damage = 0;
        counterDamage = Math.max(
          0,
          Number(rule.counterDamage || responseCard.power || 0)
        );
      } else if (responseCard.type === 'defense') {
        let block = Math.max(0, Number(responseCard.block || 0));
        if (target.leader?.id === 'piccolo') block += 15;
        const multiplier = getDefenseBlockMultiplier(attacker, pending.card);
        damage = Math.max(0, damage - Math.floor(block * multiplier));

        if (rule.reflect) {
          counterDamage += Math.max(0, Number(rule.reflect) || 0);
        }
        if (rule.stealKi) {
          const stolen = Math.min(
            Math.max(0, Number(rule.stealKi) || 0),
            attacker.ki
          );
          attacker.ki -= stolen;
          target.ki = Math.min(10, target.ki + stolen);
        }
      }

    }

    if (getCardRule(pending.card).breakShield && (!responseCard || responseCard.type === 'defense')) damage = Math.max(damage, target.hp - Math.max(0, (Math.ceil(target.hp / 50) - 1) * 50));
    const dealt = this._applyDamage(target, damage, attacker);
    this._attackPostHit(attacker, target, pending.card, dealt);
    if (responseCard) {
      this._applyReactionExtras(target, responseCard);
      if (getCardRule(responseCard).kiGainVsBeam && pending.card.isBeam && target.hp > 0) target.ki = Math.min(10, target.ki + getCardRule(responseCard).kiGainVsBeam);
      if (getCardRule(responseCard).gainInitiative || getCardRule(responseCard).stealInitiative || ['evade', 'counter'].includes(responseCard.type)) target.actionReadyAt = Date.now();
    }
    const counterDealt = counterDamage > 0
      ? this._applyDamage(attacker, counterDamage, target)
      : 0;

    this.pendingAttacks.delete(targetUid);

    this._setLastResolved({
      kind: reaction ? 'reaction' : 'attack',
      pendingId,
      attackerUid: attacker.uid,
      targetUid: target.uid,
      attackCard: pending.card,
      responseCard: responseCard ? publicCard(responseCard) : null,
      damage: dealt,
      counterDamage: counterDealt
    });

    this._emit('squad_attack_resolved', {
      pendingId,
      attackerUid: attacker.uid,
      targetUid: target.uid,
      attackCard: pending.card,
      responseCard: responseCard ? publicCard(responseCard) : null,
      damage: dealt,
      counterDamage: counterDealt
    });

    this._log(
      `${attacker.username} causou ${dealt} em ${target.username}` +
      (responseCard ? ` apos resposta ${responseCard.name}.` : '.'),
      dealt > 0 ? 'damage' : 'defense'
    );

    this._checkWinner();
    if (!this.finished) this._notify();
    return true;
  }

  _playReaction(player, index, card, cost, pending) {
    if (this.finished || Date.now() >= pending.deadline || this.getClashFor(player.uid)) return false;
    if (card.isBeam && pending.card.isBeam && this.getClashFor(pending.attackerUid)) return false;
    if (!canUseReaction(player, pending.card, card)) return false;

    this._consumeCard(player, index, card, cost);
    pending.response = {
      uid: player.uid,
      card: publicCard(card),
      playedAt: Date.now()
    };

    this._emit('squad_reaction', {
      pendingId: pending.id,
      attackerUid: pending.attackerUid,
      targetUid: pending.targetUid,
      attackCard: pending.card,
      responseCard: publicCard(card)
    });

    this._log(
      `${player.username} respondeu com ${card.name}.`,
      'reaction'
    );

    if (card.isBeam && pending.card?.isBeam && isAttackAction(card)) {
      this._startBeamClash(pending, player, card);
      this.draw(player, 1);
      this._notify();
      return true;
    }

    player.actionReadyAt = Math.max(
      player.actionReadyAt || 0,
      Date.now() + SQUAD_FAST_COOLDOWN_MS
    );

    this.draw(player, 1);
    return this._resolvePendingAttack(
      pending.targetUid,
      pending.id,
      { card }
    );
  }

  _startBeamClash(pending, responder, responseCard) {
    this._clearPendingTimer(pending.id);

    const attacker = this.getMember(pending.attackerUid)?.member;
    if (!attacker) return false;

    const attackPower = Math.max(1, Number(pending.damage) || 1);
    const responsePower = Math.max(1, this._attackDamage(responder, responseCard, [...responder.hand, responseCard]));
    const initial = clamp(
      50 + (attackPower - responsePower) * 0.16,
      35,
      65
    );

    const clash = {
      id: `clash_${crypto.randomUUID()}`,
      pendingId: pending.id,
      attackerUid: attacker.uid,
      responderUid: responder.uid,
      attackerCard: { ...pending.card, resolvedPower: attackPower },
      responderCard: publicCard({ ...responseCard, resolvedPower: responsePower }),
      attackerColor: attacker.leader?.color || '#00f2fe',
      responderColor: responder.leader?.color || '#ffd700',
      progress: initial,
      createdAt: Date.now(),
      deadline: Date.now() + SQUAD_BEAM_CLASH_MS
    };

    this.beamClashes.set(clash.id, clash);

    const timer = setTimeout(() => {
      this.clashTimers.delete(clash.id);
      this._finalizeBeamClash(clash.id);
    }, SQUAD_BEAM_CLASH_MS);
    timer.unref?.();
    this.clashTimers.set(clash.id, timer);

    this._emit('squad_beam_clash', clone(clash));
    this._log(
      `BEAM CLASH: ${attacker.username} vs ${responder.username}!`,
      'beam'
    );

    return true;
  }

  mashBeamClash(uid) {
    const clash = this.getClashFor(uid);
    if (!clash || this.finished) return false;

    const now = Date.now();
    if (now >= clash.deadline) return false;
    const throttleKey = `${clash.id}:${uid}`;
    const last = this.lastMashAt.get(throttleKey) || 0;
    if (now - last < SQUAD_MASH_THROTTLE_MS) return false;
    this.lastMashAt.set(throttleKey, now);

    const fighter = this.getMember(uid)?.member;
    if (!fighter) return false;

    const power = getBeamMashPower(fighter);
    clash.progress = clamp(
      clash.progress + (uid === clash.attackerUid ? power : -power),
      0,
      100
    );

    this._emit('squad_beam_progress', {
      clashId: clash.id,
      progress: clash.progress,
      attackerUid: clash.attackerUid,
      responderUid: clash.responderUid,
      attackerColor: clash.attackerColor,
      responderColor: clash.responderColor,
      deadline: clash.deadline
    });

    this._notify();

    if (clash.progress <= 0 || clash.progress >= 100) {
      this._finalizeBeamClash(clash.id);
    }
    return true;
  }

  _finalizeBeamClash(clashId) {
    const clash = this.beamClashes.get(clashId);
    if (!clash) return false;

    const timer = this.clashTimers.get(clashId);
    if (timer) clearTimeout(timer);
    this.clashTimers.delete(clashId);

    const pending = this.pendingAttacks.get(
      this.getMember(clash.responderUid)?.member?.uid
    );

    const attacker = this.getMember(clash.attackerUid)?.member;
    const responder = this.getMember(clash.responderUid)?.member;
    if (!attacker || !responder) {
      this.beamClashes.delete(clashId);
      return false;
    }

    const attackerWins = clash.progress >= 50;
    const winner = attackerWins ? attacker : responder;
    const loser = attackerWins ? responder : attacker;
    const winningCard = attackerWins
      ? clash.attackerCard
      : clash.responderCard;

    const damage = this._effectiveAttackDamage(loser, winningCard, Math.max(1, Number(winningCard.resolvedPower ?? winningCard.power) || 1));

    const dealt = this._applyDamage(loser, damage, winner);
    this._attackPostHit(winner, loser, winningCard, dealt);

    if (pending) {
      this._clearPendingTimer(pending.id);
      this.pendingAttacks.delete(pending.targetUid);
    }

    this.beamClashes.delete(clashId);

    this._setLastResolved({
      kind: 'beamClash',
      clashId,
      attackerUid: clash.attackerUid,
      targetUid: clash.responderUid,
      attackCard: clash.attackerCard,
      responseCard: clash.responderCard,
      winnerUid: winner.uid,
      loserUid: loser.uid,
      progress: clash.progress,
      damage: dealt
    });

    this._emit('squad_beam_resolved', {
      clashId,
      attackerUid: clash.attackerUid,
      responderUid: clash.responderUid,
      attackerCard: clash.attackerCard,
      responderCard: clash.responderCard,
      winnerUid: winner.uid,
      loserUid: loser.uid,
      progress: clash.progress,
      damage: dealt
    });

    this._log(
      `${winner.username} venceu o Beam Clash e causou ${dealt}!`,
      'beam'
    );

    this._checkWinner();
    if (!this.finished) this._notify();
    return true;
  }

  playCard(uid, handIndex, remoteCardId = null, targetUid = null) {
    if (this.finished || this.state !== 'ACTIVE') return false;

    const found = this.getMember(uid);
    const player = found?.member;
    if (!player || player.downed || player.abandoned || player.hp <= 0) return false;

    let index = Number.isInteger(handIndex) ? handIndex : -1;
    if (remoteCardId) {
      const located = player.hand.findIndex(card => card.id === remoteCardId);
      if (located < 0) return false;
      index = located;
    }
    if (index < 0 || index >= player.hand.length) return false;

    const card = player.hand[index];
    const cost = getEffectiveCardCost(player, card);
    if (player.ki < cost) return false;

    const pending = this.getPendingFor(uid);
    if (pending) {
      return this._playReaction(player, index, card, cost, pending);
    }

    if (this.getClashFor(uid)) return false;
    if (!this.canAct(uid)) return false;

    const validType =
      isAttackAction(card) ||
      isImmediateTechnique(card);

    if (!validType) return false;

    const handBefore = [...player.hand];

    if (isAttackAction(card)) {
      const target = this.getEnemies(uid).find(enemy => enemy.uid === targetUid) || null;
      if (!target) return false;
      if (this.getPendingFor(target.uid) || this.getClashFor(target.uid)) return false;

      this._consumeCard(player, index, card, cost);
      const damage = this._attackDamage(player, card, handBefore);
      this._createPendingAttack(player, target, card, damage);
      this._setCooldown(player, card);
      this.draw(player, 1);
      this._notify();
      return true;
    }

    this._consumeCard(player, index, card, cost);
    this._applyImmediateTechnique(player, card);
    this._setCooldown(player, card);
    this.draw(player, 1);

    this._emit('squad_card_played', {
      pendingId: null,
      attackerUid: player.uid,
      targetUid: player.uid,
      card: publicCard(card),
      deadline: null
    });

    this._setLastResolved({
      kind: 'technique',
      attackerUid: player.uid,
      targetUid: player.uid,
      attackCard: publicCard(card),
      responseCard: null,
      damage: 0
    });

    this._log(`${player.username} usou ${card.name}.`, 'info');
    this._checkWinner();
    if (!this.finished) this._notify();
    return true;
  }

  chargeKi(uid) {
    if (!this.canAct(uid)) return false;

    const player = this.getMember(uid)?.member;
    if (!player) return false;
    if (player.ki >= 10) return false;

    const enemyFrieza =
      this.getEnemies(uid).find(enemy => enemy.leader?.id === 'frieza') ||
      null;

    const amount = getChargeAmount(player, enemyFrieza);
    player.ki = Math.min(10, player.ki + amount);
    player.openGuardUntil = Date.now() + 3500;
    player.actionReadyAt = Date.now() + 1100;

    this._log(`${player.username} carregou ${amount} Ki.`, 'charge');
    this._emit('squad_charge', { uid, amount });
    this._notify();
    return true;
  }

  passTurn(uid) {
    if (!this.canAct(uid)) return false;
    const player = this.getMember(uid)?.member;
    if (!player) return false;

    player.actionReadyAt = Date.now() + SQUAD_FAST_COOLDOWN_MS;
    this._log(`${player.username} reposicionou-se no campo.`, 'info');
    this._notify();
    return true;
  }

  action(uid, action, data = {}) {
    switch (action) {
      case 'playCard':
        return this.playCard(
          uid,
          data.cardIndex,
          data.cardId,
          data.targetUid
        );
      case 'chargeKi':
        return this.chargeKi(uid);
      case 'passTurn':
        return this.passTurn(uid);
      case 'mashBeamClash':
        return this.mashBeamClash(uid);
      default:
        return false;
    }
  }

  abandon(uid) {
    const found = this.getMember(uid);
    if (!found || found.member.abandoned) return false;

    found.member.abandoned = true;
    found.member.downed = true;
    found.member.hp = 0;
    this._cancelIncomingTo(uid);

    this._log(`${found.member.username} deixou a batalha.`, 'info');
    if (!this._checkWinner()) this._notify();
    return true;
  }

  tick(_now = Date.now()) {
    return !this.finished;
  }

  _checkWinner() {
    const aliveA = this.getAlive('A');
    const aliveB = this.getAlive('B');

    if (!aliveA.length && !aliveB.length) {
      const hpA = this.teams.A.reduce(
        (sum, p) => sum + Math.max(0, p.hp),
        0
      );
      const hpB = this.teams.B.reduce(
        (sum, p) => sum + Math.max(0, p.hp),
        0
      );
      this._complete(hpA >= hpB ? 'A' : 'B');
      return true;
    }

    if (!aliveA.length) {
      this._complete('B');
      return true;
    }

    if (!aliveB.length) {
      this._complete('A');
      return true;
    }

    return false;
  }

  _publicMember(member) {
    return {
      uid: member.uid,
      username: member.username,
      side: member.side,
      leader: member.leader,
      isBot: !!member.isBot,
      hp: member.hp,
      maxHp: member.maxHp,
      ki: member.ki,
      isAwakened: member.isAwakened,
      isOpenGuard: member.isOpenGuard,
      nextAttackBonus: member.nextAttackBonus,
      downed: member.downed,
      abandoned: member.abandoned,
      handSize: member.hand.length,
      actionReadyAt: member.actionReadyAt
    };
  }

  _publicPending() {
    return [...this.pendingAttacks.values()]
      .sort((a, b) => a.createdAt - b.createdAt)
      .map(pending => ({
        id: pending.id,
        attackerUid: pending.attackerUid,
        targetUid: pending.targetUid,
        card: clone(pending.card),
        response: pending.response ? clone(pending.response) : null,
        createdAt: pending.createdAt,
        deadline: pending.deadline
      }));
  }

  _publicClashes() {
    return [...this.beamClashes.values()]
      .sort((a, b) => a.createdAt - b.createdAt)
      .map(clash => clone(clash));
  }

  getCanonicalPublicState() {
    return {
      mode: '2v2-realtime',
      state: this.state,
      stateVersion: this.stateVersion,
      teamWinner: this.teamWinner,
      finished: this.finished,
      startedAt: this.startedAt,
      teams: {
        A: this.teams.A.map(member => this._publicMember(member)),
        B: this.teams.B.map(member => this._publicMember(member))
      },
      pendingAttacks: this._publicPending(),
      beamClashes: this._publicClashes(),
      lastResolved: this.lastResolved ? clone(this.lastResolved) : null,
      logs: clone(this.logs)
    };
  }

  getStateFor(uid) {
    const found = this.getMember(uid);
    if (!found) return null;

    const publicState = this.getCanonicalPublicState();
    return {
      ...publicState,
      teamSide: found.side,
      you: {
        ...this._publicMember(found.member),
        hand: clone(found.member.hand),
        canAct: this.canAct(uid),
        canReact: this.canReact(uid)
      }
    };
  }
}
