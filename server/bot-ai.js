import crypto from 'node:crypto';
import { LEADERS, getStarterDeckForLeader } from '../js/card-database.js';
import {
  getCardRule,
  getEffectiveCardCost,
  getLeaderAttackBonus,
  isAttackAction,
  isImmediateTechnique
} from '../js/content-rules.js';
import { raidBossAttackProfile } from '../js/raid-rules.js';

export const BOT_FILL_DELAY_MS = 15_000;
export const BOT_THINK_MIN_MS = 380;
export const BOT_THINK_MAX_MS = 720;

const BOT_NAMES = [
  'CPU Kakarot', 'CPU Capsule', 'CPU Namek', 'CPU Kaioshin',
  'CPU Red Ribbon', 'CPU Patrulheiro', 'CPU Saiyajin', 'CPU Torneio'
];

function randomInt(max) {
  return max > 0 ? crypto.randomInt(0, max) : 0;
}

function choose(list) {
  return list[randomInt(list.length)];
}

export function isBotUid(uid) {
  return String(uid || '').startsWith('bot_');
}

export function createBotProfile({
  mode = 'match',
  leader = null,
  difficulty = 'normal',
  index = 0
} = {}) {
  const leaderIds = Object.keys(LEADERS);
  const selectedLeader = leader && LEADERS[leader] ? leader : choose(leaderIds);

  return {
    socketId: null,
    uid: `bot_${mode}_${crypto.randomUUID()}`,
    username: `${BOT_NAMES[index % BOT_NAMES.length]} ${String(index + 1).padStart(2, '0')}`,
    leader: selectedLeader,
    deck: [...getStarterDeckForLeader(selectedLeader)],
    isBot: true,
    botDifficulty: difficulty
  };
}

function fighterFor(engine, key) {
  return key === 'player' ? engine.player : engine.opponent;
}

function otherKey(key) {
  return key === 'player' ? 'opponent' : 'player';
}

function hpRatio(fighter) {
  return Math.max(0, Number(fighter?.hp) || 0) / Math.max(1, Number(fighter?.maxHp) || 1);
}

function scoreTechnique(engine, actorKey, card) {
  const actor = fighterFor(engine, actorKey);
  const rule = getCardRule(card);
  let score = 6;

  const missingHp = Math.max(0, actor.maxHp - actor.hp);
  if (rule.heal) score += Math.min(rule.heal, missingHp) * (hpRatio(actor) <= 0.35 ? 1.4 : 0.65);
  if (rule.kiGain) score += Math.min(rule.kiGain, 10 - actor.ki) * 10;
  if (rule.draw) score += rule.draw * (actor.hand.length <= 3 ? 18 : 10);
  if (rule.nextAttackBonus) score += rule.nextAttackBonus * 0.9;

  if (rule.selfDamage) {
    score -= rule.selfDamage * (actor.hp <= rule.selfDamage + 40 ? 5 : 0.55);
  }

  if (rule.heal && missingHp === 0) score -= 35;
  if (rule.kiGain && actor.ki >= 9) score -= 20;
  return score;
}

function scoreAttack(engine, actorKey, card) {
  const actor = fighterFor(engine, actorKey);
  const target = fighterFor(engine, otherKey(actorKey));
  const hand = actor.hand || [];
  const rule = getCardRule(card);
  let damage = Math.max(0, Number(card.power) || 0) + getLeaderAttackBonus(actor, card, hand);
  if (actor.nextAttackBonus && card.type === 'attack') damage += actor.nextAttackBonus;
  if (target.isOpenGuard) damage = Math.floor(damage * 1.5);

  let score = damage;
  if (damage >= target.hp) score += 500;
  if (rule.retainInitiative) score += 35;
  if (rule.drainKi) score += rule.drainKi * 14;
  if (rule.burnDefense) score += 18;
  if (rule.breakShield) score += 24;
  if (card.isBeam && actor.ki >= 6) score += 8;
  return score;
}

function reactionScore(engine, botKey, card) {
  const defender = fighterFor(engine, botKey);
  const attack = engine.pendingAttack?.card;
  if (!attack) return -Infinity;

  let incoming = Math.max(0, Number(attack.resolvedPower ?? attack.power) || 0);
  if (defender.isOpenGuard) incoming = Math.floor(incoming * 1.5);

  const rule = getCardRule(card);
  if (card.type === 'evade') {
    return incoming * 1.35 + (incoming >= defender.hp ? 500 : 45) + (rule.draw || 0) * 10;
  }

  if (card.type === 'counter') {
    return incoming * 0.75 + Number(rule.counterDamage || card.power || 0) * 1.25 +
      (incoming >= defender.hp ? 260 : 0);
  }

  if (card.type === 'defense') {
    const block = Math.max(0, Number(card.block) || 0) + (defender.leader?.id === 'piccolo' ? 15 : 0);
    const prevented = Math.min(incoming, block);
    return prevented * 1.2 + (incoming >= defender.hp && block >= incoming ? 420 : 0) +
      (rule.heal || 0) * 0.7 + (rule.draw || 0) * 10;
  }

  if (card.isBeam && isAttackAction(card) && attack.isBeam) {
    return Math.max(0, Number(card.power) || 0) + 55;
  }

  return 0;
}

export function chooseDuelBotAction(engine, botKey = 'opponent') {
  if (!engine || engine.state === 'GAME_OVER') return null;
  const actor = fighterFor(engine, botKey);
  if (!actor) return null;

  if (engine.state === 'BEAM_CLASH') {
    return { action: 'mashBeamClash' };
  }

  if (engine.state === 'ATTACK_PENDING') {
    const defenderKey = otherKey(engine.pendingAttack?.attackerKey);
    if (defenderKey !== botKey) return null;

    const options = actor.hand
      .map((card, index) => ({ card, index }))
      .filter(({ card }) => card && engine.getCardCost(botKey, card) <= actor.ki)
      .filter(({ card }) => engine.isReactionCardLegal(botKey, card, engine.pendingAttack?.card))
      .map(item => ({ ...item, score: reactionScore(engine, botKey, item.card) }))
      .sort((a, b) => b.score - a.score);

    if (!options.length) return null;
    return { action: 'playCard', cardIndex: options[0].index, cardId: options[0].card.id };
  }

  if (engine.state !== 'FREE_ACTION' || engine.initiative !== botKey) return null;

  const playable = actor.hand
    .map((card, index) => ({ card, index }))
    .filter(({ card }) => card && getEffectiveCardCost(actor, card) <= actor.ki)
    .filter(({ card }) => isAttackAction(card) || isImmediateTechnique(card))
    .map(item => ({
      ...item,
      score: isImmediateTechnique(item.card)
        ? scoreTechnique(engine, botKey, item.card)
        : scoreAttack(engine, botKey, item.card)
    }))
    .sort((a, b) => b.score - a.score);

  const best = playable[0];

  if (best && (best.score >= 18 || actor.ki >= 8 || hpRatio(actor) <= 0.35)) {
    return { action: 'playCard', cardIndex: best.index, cardId: best.card.id };
  }

  if (actor.ki < 10) return { action: 'chargeKi' };
  if (best) return { action: 'playCard', cardIndex: best.index, cardId: best.card.id };
  return { action: 'passTurn' };
}

function randomThinkDelay() {
  return BOT_THINK_MIN_MS + randomInt(BOT_THINK_MAX_MS - BOT_THINK_MIN_MS + 1);
}

export class DuelBotController {
  constructor({ engine, botKey = 'opponent' } = {}) {
    this.engine = engine;
    this.botKey = botKey;
    this.timer = null;
    this.disposed = false;
  }

  _isActionable() {
    if (!this.engine || this.engine.state === 'GAME_OVER') return false;
    if (this.engine.state === 'BEAM_CLASH') return true;
    if (this.engine.state === 'FREE_ACTION') return this.engine.initiative === this.botKey;
    if (this.engine.state === 'ATTACK_PENDING') {
      return otherKey(this.engine.pendingAttack?.attackerKey) === this.botKey &&
        !!chooseDuelBotAction(this.engine, this.botKey);
    }
    return false;
  }

  poke() {
    if (this.disposed) return;
    if (!this._isActionable()) {
      if (this.timer) {
        clearTimeout(this.timer);
        this.timer = null;
      }
      return;
    }
    if (this.timer) return;

    const delay = this.engine.state === 'BEAM_CLASH' ? 120 + randomInt(80) : randomThinkDelay();
    this.timer = setTimeout(() => {
      this.timer = null;
      this.act();
    }, delay);
    this.timer.unref?.();
  }

  act() {
    if (this.disposed) return false;
    const decision = chooseDuelBotAction(this.engine, this.botKey);
    if (!decision) return false;

    let result = false;
    switch (decision.action) {
      case 'playCard':
        result = this.engine._playCard(this.botKey, decision.cardIndex, decision.cardId);
        break;
      case 'chargeKi':
        result = this.engine._chargeKi(this.botKey);
        break;
      case 'passTurn':
        result = this.engine._passTurn(this.botKey) !== false;
        break;
      case 'mashBeamClash':
        result = this.engine._mashBeamClash(this.botKey);
        break;
      default:
        break;
    }

    queueMicrotask(() => this.poke());
    return result;
  }

  dispose() {
    this.disposed = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }
}

export class TagTeamBotController {
  constructor({ teamEngine } = {}) {
    this.teamEngine = teamEngine;
    this.timer = null;
    this.disposed = false;
  }

  _activeBot() {
    const engine = this.teamEngine?.engine;
    if (!engine || this.teamEngine.finished) return null;

    for (const side of ['A', 'B']) {
      const member = this.teamEngine.getActiveMember(side);
      if (!member?.isBot) continue;
      const key = this.teamEngine.sideToKey(side);

      if (engine.state === 'FREE_ACTION' && engine.initiative === key) return { member, key };
      if (engine.state === 'ATTACK_PENDING' && otherKey(engine.pendingAttack?.attackerKey) === key) {
        if (chooseDuelBotAction(engine, key)) return { member, key };
      }
      if (engine.state === 'BEAM_CLASH') return { member, key };
    }

    return null;
  }

  poke() {
    if (this.disposed) return;
    const active = this._activeBot();
    if (!active) {
      if (this.timer) {
        clearTimeout(this.timer);
        this.timer = null;
      }
      return;
    }
    if (this.timer) return;

    const delay = this.teamEngine.engine.state === 'BEAM_CLASH' ? 130 + randomInt(80) : randomThinkDelay();
    this.timer = setTimeout(() => {
      this.timer = null;
      const current = this._activeBot();
      if (!current) return;

      const decision = chooseDuelBotAction(this.teamEngine.engine, current.key);
      if (!decision) return;
      this.teamEngine.action(current.member.uid, decision.action, {
        cardIndex: decision.cardIndex,
        cardId: decision.cardId
      });
      queueMicrotask(() => this.poke());
    }, delay);
    this.timer.unref?.();
  }

  dispose() {
    this.disposed = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }
}

function raidCardScore(engine, player, card) {
  const cost = getEffectiveCardCost(player, card);
  if (cost > player.ki) return -Infinity;
  const rule = getCardRule(card);
  const hp = hpRatio(player);
  const ultimateSoon = engine.round % 3 === 0 || engine.boss.phase >= 3;

  if (isAttackAction(card)) {
    const damage = Math.max(0, Number(card.power) || 0) +
      getLeaderAttackBonus(player, card, player.hand || []) +
      Math.max(0, Number(player.nextAttackBonus) || 0);
    let score = damage;
    if (damage >= engine.boss.hp) score += 1000;
    if (rule.retainInitiative) score += 30;
    return score;
  }

  if (isImmediateTechnique(card)) {
    let score = 8;
    const missingHp = Math.max(0, player.maxHp - player.hp);
    if (rule.heal) score += Math.min(rule.heal, missingHp) * (hp <= 0.4 ? 1.6 : 0.7);
    if (rule.kiGain) score += Math.min(rule.kiGain, 10 - player.ki) * 9;
    if (rule.draw) score += rule.draw * 13;
    if (rule.nextAttackBonus) score += rule.nextAttackBonus;
    if (rule.selfDamage) score -= rule.selfDamage * (hp <= 0.3 ? 4 : 0.5);
    return score;
  }

  if (card.type === 'evade') return ultimateSoon ? 95 : 45;
  if (card.type === 'counter') return (ultimateSoon ? 60 : 30) + Number(rule.counterDamage || card.power || 0);
  if (card.type === 'defense') {
    return (ultimateSoon ? 55 : 20) + Number(card.block || 0) * (hp <= 0.45 ? 1.15 : 0.65);
  }

  return -Infinity;
}

export function chooseRaidBotAction(engine, uid) {
  if (!engine || engine.finished || engine.state !== 'ACTIVE') return null;
  const player = engine.getPlayer(uid);
  if (!player || !player.isBot || player.uid !== engine.currentPlayerUid || player.downed || player.abandoned) return null;

  const options = player.hand
    .map((card, index) => ({ card, index, score: raidCardScore(engine, player, card) }))
    .filter(item => Number.isFinite(item.score))
    .sort((a, b) => b.score - a.score);

  const best = options[0];
  if (best && (best.score >= 22 || player.ki >= 8 || hpRatio(player) <= 0.4)) {
    return { action: 'playCard', cardIndex: best.index, cardId: best.card.id };
  }

  if (player.ki < 9) return { action: 'chargeKi' };
  if (best) return { action: 'playCard', cardIndex: best.index, cardId: best.card.id };
  return { action: 'passTurn' };
}

export class RaidBotController {
  constructor({ engine } = {}) {
    this.engine = engine;
    this.timer = null;
    this.disposed = false;
  }

  poke() {
    if (this.disposed || !this.engine || this.engine.finished) return;
    const player = this.engine.currentPlayer;
    if (this.engine.state !== 'ACTIVE' || !player?.isBot) {
      if (this.timer) {
        clearTimeout(this.timer);
        this.timer = null;
      }
      return;
    }
    if (this.timer) return;

    this.timer = setTimeout(() => {
      this.timer = null;
      const current = this.engine.currentPlayer;
      if (!current?.isBot) return;
      const decision = chooseRaidBotAction(this.engine, current.uid);
      if (!decision) return;
      if (decision.action === 'playCard') {
        this.engine.playCard(current.uid, decision.cardIndex, decision.cardId);
      } else if (decision.action === 'chargeKi') {
        this.engine.chargeKi(current.uid);
      } else {
        this.engine.passTurn(current.uid);
      }
      queueMicrotask(() => this.poke());
    }, randomThinkDelay());
    this.timer.unref?.();
  }

  dispose() {
    this.disposed = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }
}

export function chooseRaidBossDecision({ boss, players = [], phase = 1, round = 1 } = {}) {
  const alive = players.filter(player => !player.downed && !player.abandoned && player.hp > 0);
  const profile = raidBossAttackProfile(boss, phase, round);
  if (!alive.length) return { profile, targetUids: [] };

  if (profile.mode === 'all') {
    return { profile, targetUids: alive.map(player => player.uid) };
  }

  const scored = alive.map(player => {
    const missingHp = Math.max(0, player.maxHp - player.hp);
    const threat = Math.max(0, Number(player.threat) || 0);
    let score = threat * 0.7 + missingHp * 0.35 + Math.max(0, Number(player.ki) || 0) * 2;

    if (boss?.id === 'cell_max') score += missingHp * 0.35;
    if (boss?.id === 'broly') score += threat * 0.35 + player.maxHp * 0.05;
    if (boss?.id === 'jiren') score += (player.isAwakened ? 40 : 0) + player.ki * 3;
    if (player.hp <= Math.max(60, profile.damage)) score += 120;

    return { player, score };
  }).sort((a, b) => b.score - a.score);

  const count = profile.mode === 'two' ? Math.min(2, scored.length) : 1;
  return {
    profile,
    targetUids: scored.slice(0, count).map(item => item.player.uid)
  };
}
