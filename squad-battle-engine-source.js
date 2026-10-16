import crypto from 'node:crypto';
import { LEADERS, getCardById } from '../js/card-database.js';
import {
  getCardRule,
  getEffectiveCardCost,
  getLeaderAttackBonus,
  getChargeAmount,
  getDefenseBlockMultiplier,
  isAttackAction,
  isImmediateTechnique,
  isPhysicalAttack,
  isKiAttack
} from '../js/content-rules.js';

export const SQUAD_ACTION_COOLDOWN_MS = 1800;
export const SQUAD_FAST_COOLDOWN_MS = 700;

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
    this.logs = [];
    this.startedAt = Date.now();

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
      guardBlock: 0,
      dodgeNext: false,
      dodgeRule: null,
      counterNext: 0,
      counterRule: null,
      reflectNext: 0,
      stealKiNext: 0,
      downed: false,
      abandoned: false,
      hand: [],
      deck: shuffleSecure(entry.deck || []),
      discard: [],
      actionReadyAt: Date.now() + 500
    };
  }

  _log(text, type = 'info') {
    this.logs.unshift({ text, type, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) });
    if (this.logs.length > 50) this.logs.length = 50;
  }

  _notify() {
    this.stateVersion += 1;
    this.onState(this);
  }

  _complete(winnerSide) {
    if (this.finished) return;
    this.finished = true;
    this.state = 'GAME_OVER';
    this.teamWinner = winnerSide;
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
    return this.getTeam(side).filter(member => !member.downed && !member.abandoned && member.hp > 0);
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

  canAct(uid, now = Date.now()) {
    if (this.finished || this.state !== 'ACTIVE') return false;
    const found = this.getMember(uid);
    const player = found?.member;
    return !!player && !player.downed && !player.abandoned && player.hp > 0 && now >= (player.actionReadyAt || 0);
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
      if (card) player.hand.push({ ...card, instanceId: `${card.id}_${crypto.randomUUID()}` });
    }
  }

  _awakenIfNeeded(player) {
    if (!player || player.isAwakened || player.hp <= 0) return;
    if (player.hp <= (player.leader.awakenThresholdHp || 200)) {
      player.isAwakened = true;
      if (player.leader.id === 'piccolo') player.hp = Math.min(player.maxHp, player.hp + 50);
      this._log(`${player.username} despertou ${player.leader.awakenedName || 'Poder Total'}.`, 'awaken');
    }
  }

  _setCooldown(player, card = null) {
    const rule = card ? getCardRule(card) : {};
    const ms = rule.retainInitiative ? SQUAD_FAST_COOLDOWN_MS : SQUAD_ACTION_COOLDOWN_MS;
    player.actionReadyAt = Date.now() + ms;
  }

  _applyTechnique(player, card) {
    const rule = getCardRule(card);
    if (rule.selfDamage) {
      player.hp = Math.max(0, player.hp - rule.selfDamage);
      if (player.hp <= 0) player.downed = true;
    }
    if (rule.heal) player.hp = Math.min(player.maxHp, player.hp + rule.heal);
    if (rule.kiGain) player.ki = Math.min(10, player.ki + rule.kiGain);
    if (rule.draw) this.draw(player, rule.draw);
    if (rule.nextAttackBonus) player.nextAttackBonus += rule.nextAttackBonus;
    this._awakenIfNeeded(player);
  }

  _prepareReaction(player, card) {
    const rule = getCardRule(card);
    if (card.type === 'defense') {
      let block = Number(card.block || 0);
      if (player.leader.id === 'piccolo') block += 15;
      player.guardBlock = Math.max(player.guardBlock, block);
      player.reflectNext = Math.max(player.reflectNext, Number(rule.reflect || 0));
      player.stealKiNext = Math.max(player.stealKiNext, Number(rule.stealKi || 0));
      if (rule.heal) player.hp = Math.min(player.maxHp, player.hp + rule.heal);
      if (rule.kiGain) player.ki = Math.min(10, player.ki + rule.kiGain);
      if (rule.draw) this.draw(player, rule.draw);
    } else if (card.type === 'evade') {
      player.dodgeNext = true;
      player.dodgeRule = { ...rule };
      if (rule.kiGain) player.ki = Math.min(10, player.ki + rule.kiGain);
      if (rule.draw) this.draw(player, rule.draw);
    } else if (card.type === 'counter') {
      player.counterNext = Math.max(player.counterNext, Number(rule.counterDamage || card.power || 0));
      player.counterRule = { ...rule };
      if (rule.kiGain) player.ki = Math.min(10, player.ki + rule.kiGain);
    }
  }

  _consumeBurnDefense(target, count = 1) {
    let remaining = Math.max(0, Number(count) || 0);
    for (let i = target.hand.length - 1; i >= 0 && remaining > 0; i--) {
      if (target.hand[i]?.type !== 'defense') continue;
      const [burned] = target.hand.splice(i, 1);
      target.discard.push(burned.id);
      remaining -= 1;
    }
  }

  _reactionAllowed(rule, attackCard) {
    if (!rule) return true;
    if (rule.beamOnly && !attackCard?.isBeam) return false;
    if (rule.physicalOnly && !isPhysicalAttack(attackCard)) return false;
    return true;
  }

  _resolveAttack(attacker, target, card, handBefore) {
    const rule = getCardRule(card);
    let damage = Math.max(0, Number(card.power || 0) + getLeaderAttackBonus(attacker, card, handBefore));
    damage += Math.max(0, Number(attacker.nextAttackBonus) || 0);
    attacker.nextAttackBonus = 0;

    if (rule.breakShield) target.guardBlock = 0;

    if (target.dodgeNext && this._reactionAllowed(target.dodgeRule, card)) {
      target.dodgeNext = false;
      target.dodgeRule = null;
      damage = 0;
      this._log(`${target.username} esquivou de ${card.name}.`, 'evade');
    } else {
      target.dodgeNext = false;
      target.dodgeRule = null;
      const blockMultiplier = rule.unblockableDefense ? 0 : getDefenseBlockMultiplier(attacker, card);
      const block = Math.max(0, Math.floor((target.guardBlock || 0) * blockMultiplier));
      damage = Math.max(0, damage - block);
      target.guardBlock = 0;
      target.hp = Math.max(0, target.hp - damage);
      this._log(`${attacker.username} causou ${damage} em ${target.username} com ${card.name}.`, 'damage');
    }

    if (rule.drainKi) target.ki = Math.max(0, target.ki - Number(rule.drainKi || 0));
    if (rule.burnDefense) this._consumeBurnDefense(target, rule.burnDefense);

    if (target.stealKiNext > 0) {
      const stolen = Math.min(target.stealKiNext, attacker.ki);
      attacker.ki -= stolen;
      target.ki = Math.min(10, target.ki + stolen);
      target.stealKiNext = 0;
    }

    if (target.reflectNext > 0 && attacker.hp > 0) {
      attacker.hp = Math.max(0, attacker.hp - target.reflectNext);
      target.reflectNext = 0;
    }

    if (target.counterNext > 0) {
      const allowed = this._reactionAllowed(target.counterRule, card);
      const counter = target.counterNext;
      target.counterNext = 0;
      target.counterRule = null;
      if (allowed && target.hp > 0) {
        attacker.hp = Math.max(0, attacker.hp - counter);
        this._log(`${target.username} contra-atacou ${attacker.username} em ${counter}.`, 'counter');
      }
    }

    if (target.hp <= 0) {
      target.downed = true;
      this._log(`${target.username} foi nocauteado.`, 'ko');
    } else {
      this._awakenIfNeeded(target);
    }

    if (attacker.hp <= 0) attacker.downed = true;
    else this._awakenIfNeeded(attacker);

    this.onFx('squad_attack', {
      attackerUid: attacker.uid,
      targetUid: target.uid,
      card: { id: card.id, name: card.name, type: card.type, isBeam: !!card.isBeam },
      damage
    });

    return damage;
  }

  _checkWinner() {
    const aliveA = this.getAlive('A');
    const aliveB = this.getAlive('B');
    if (!aliveA.length && !aliveB.length) {
      const hpA = this.teams.A.reduce((sum, p) => sum + Math.max(0, p.hp), 0);
      const hpB = this.teams.B.reduce((sum, p) => sum + Math.max(0, p.hp), 0);
      this._complete(hpA >= hpB ? 'A' : 'B');
      return true;
    }
    if (!aliveA.length) { this._complete('B'); return true; }
    if (!aliveB.length) { this._complete('A'); return true; }
    return false;
  }

  playCard(uid, handIndex, remoteCardId = null, targetUid = null) {
    if (!this.canAct(uid)) return false;
    const found = this.getMember(uid);
    const player = found.member;

    let index = Number.isInteger(handIndex) ? handIndex : -1;
    if (remoteCardId) {
      const located = player.hand.findIndex(card => card.id === remoteCardId);
      if (located >= 0) index = located;
    }
    if (index < 0 || index >= player.hand.length) return false;

    const card = player.hand[index];
    const cost = getEffectiveCardCost(player, card);
    if (player.ki < cost) return false;

    const validType = isAttackAction(card) || isImmediateTechnique(card) || ['defense', 'evade', 'counter'].includes(card.type);
    if (!validType) return false;

    let target = null;
    if (isAttackAction(card)) {
      target = this.getEnemies(uid).find(enemy => enemy.uid === targetUid) || null;
      if (!target) return false;
    }

    const handBefore = [...player.hand];
    player.ki -= cost;
    player.hand.splice(index, 1);
    player.discard.push(card.id);

    if (isAttackAction(card)) {
      this._resolveAttack(player, target, card, handBefore);
    } else if (isImmediateTechnique(card)) {
      this._applyTechnique(player, card);
      this._log(`${player.username} usou ${card.name}.`, 'info');
    } else {
      this._prepareReaction(player, card);
      this._log(`${player.username} preparou ${card.name}.`, 'info');
    }

    this._setCooldown(player, card);
    if (!this.finished) {
      this.draw(player, 1);
      this._checkWinner();
      if (!this.finished) this._notify();
    }
    return true;
  }

  chargeKi(uid) {
    if (!this.canAct(uid)) return false;
    const found = this.getMember(uid);
    const player = found.member;
    const enemyFrieza = this.getEnemies(uid).find(enemy => enemy.leader?.id === 'frieza') || null;
    const amount = getChargeAmount(player, enemyFrieza);
    player.ki = Math.min(10, player.ki + amount);
    player.actionReadyAt = Date.now() + 1100;
    this._log(`${player.username} carregou ${amount} Ki.`, 'charge');
    this._notify();
    return true;
  }

  passTurn(uid) {
    if (!this.canAct(uid)) return false;
    const player = this.getMember(uid)?.member;
    if (!player) return false;
    player.actionReadyAt = Date.now() + SQUAD_FAST_COOLDOWN_MS;
    this._log(`${player.username} aguardou uma janela de combate.`, 'info');
    this._notify();
    return true;
  }

  action(uid, action, data = {}) {
    switch (action) {
      case 'playCard':
        return this.playCard(uid, data.cardIndex, data.cardId, data.targetUid);
      case 'chargeKi':
        return this.chargeKi(uid);
      case 'passTurn':
        return this.passTurn(uid);
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
    this._log(`${found.member.username} deixou a batalha.`, 'info');
    if (!this._checkWinner()) this._notify();
    return true;
  }

  tick(_now = Date.now()) {
    return !this.finished;
  }

  getStateFor(uid) {
    const found = this.getMember(uid);
    if (!found) return null;

    const publicMember = member => ({
      uid: member.uid,
      username: member.username,
      side: member.side,
      leader: member.leader,
      isBot: !!member.isBot,
      hp: member.hp,
      maxHp: member.maxHp,
      ki: member.ki,
      isAwakened: member.isAwakened,
      guardBlock: member.guardBlock,
      dodgeNext: member.dodgeNext,
      counterNext: member.counterNext,
      downed: member.downed,
      abandoned: member.abandoned,
      handSize: member.hand.length,
      actionReadyAt: member.actionReadyAt
    });

    return {
      mode: '2v2-realtime',
      state: this.state,
      stateVersion: this.stateVersion,
      teamSide: found.side,
      teamWinner: this.teamWinner,
      finished: this.finished,
      startedAt: this.startedAt,
      teams: {
        A: this.teams.A.map(publicMember),
        B: this.teams.B.map(publicMember)
      },
      you: {
        ...publicMember(found.member),
        hand: clone(found.member.hand),
        canAct: this.canAct(uid)
      },
      logs: clone(this.logs)
    };
  }
}
