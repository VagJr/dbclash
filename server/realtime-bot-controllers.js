import crypto from 'node:crypto';
import {
  canUseReaction,
  getCardRule,
  getEffectiveCardCost,
  getLeaderAttackBonus,
  isAttackAction,
  isImmediateTechnique
} from '../js/content-rules.js';
import { npcOptionsFor, npcThinkDelay, NPC_DIFFICULTIES, selectNpcOption, scoreNpcAttack, scoreNpcTechnique, scoreNpcReaction } from '../js/npc-ai.js';

const THINK_MIN = 320;
const THINK_MAX = 680;

function rand(max) {
  return max > 0 ? crypto.randomInt(0, max) : 0;
}

function thinkDelay() {
  return THINK_MIN + rand(THINK_MAX - THINK_MIN + 1);
}

function hpRatio(player) {
  return Math.max(0, Number(player?.hp) || 0) / Math.max(1, Number(player?.maxHp) || 1);
}

function scoreSelfCard(player, card) {
  const rule = getCardRule(card);
  let score = 0;
  const missing = Math.max(0, player.maxHp - player.hp);

  if (isImmediateTechnique(card)) {
    score += 12;
    if (rule.heal) score += Math.min(missing, rule.heal) * (hpRatio(player) < 0.45 ? 1.7 : 0.7);
    if (rule.kiGain) score += Math.min(rule.kiGain, 10 - player.ki) * 10;
    if (rule.draw) score += rule.draw * 14;
    if (rule.nextAttackBonus) score += rule.nextAttackBonus;
    if (rule.selfDamage) score -= rule.selfDamage * (hpRatio(player) < 0.35 ? 4 : 0.6);
  } else if (card.type === 'defense') {
    score = (hpRatio(player) < 0.5 ? 75 : 28) + Number(card.block || 0) * 0.7;
  } else if (card.type === 'evade') {
    score = hpRatio(player) < 0.45 ? 92 : 38;
  } else if (card.type === 'counter') {
    score = (hpRatio(player) < 0.55 ? 62 : 30) + Number(rule.counterDamage || card.power || 0);
  }

  return score;
}

function scoreAttack(player, target, card) {
  const rule = getCardRule(card);
  let damage = Math.max(0, Number(card.power) || 0) + getLeaderAttackBonus(player, card, player.hand || []);
  damage += Math.max(0, Number(player.nextAttackBonus) || 0);
  let score = damage + (1 - hpRatio(target)) * 90;
  if (damage >= target.hp) score += 700;
  if (rule.drainKi) score += Number(rule.drainKi) * 12;
  if (rule.burnDefense) score += 24;
  if (rule.breakShield) score += 20;
  return score;
}

export function chooseSquadBotAction(engine, uid) {
  const found = engine?.getMember(uid);
  const player = found?.member;
  if (!player || !player.isBot || player.downed || player.abandoned) return null;
  const config = npcOptionsFor(player);

  const clash = engine.getClashFor?.(uid);
  if (clash) return { action: 'mashBeamClash', score: 1000 };

  const pending = engine.getPendingFor?.(uid);
  if (pending) {
    const reactions = player.hand
      .map((card, index) => ({ card, index }))
      .filter(({ card }) => card && getEffectiveCardCost(player, card) <= player.ki)
      .filter(({ card }) => canUseReaction(player, pending.card, card))
      .map(item => ({ ...item, ...scoreNpcReaction(player, engine.getMember(pending.attackerUid).member, { ...pending.card, resolvedPower: pending.damage }, item.card, config) }))
      .sort((a, b) => b.score - a.score);

    const best = selectNpcOption(reactions, config, () => rand(1000000) / 1000000);
    if (!best) return null;
    return {
      action: 'playCard',
      cardIndex: best.index,
      cardId: best.card.id,
      targetUid: null,
      score: best.score
    };
  }

  if (!engine.canAct(uid)) return null;

  const enemies = engine.getEnemies(uid);
  if (!enemies.length) return null;

  const options = [];
  player.hand.forEach((card, index) => {
    if (!card || getEffectiveCardCost(player, card) > player.ki) return;

    if (isAttackAction(card)) {
      for (const target of enemies) {
        if (engine.getPendingFor?.(target.uid) || engine.getClashFor?.(target.uid)) continue;
        options.push({
          action: 'playCard',
          cardIndex: index,
          cardId: card.id,
          targetUid: target.uid,
          ...scoreNpcAttack(player, target, card, config)
        });
      }
      return;
    }

    if (isImmediateTechnique(card)) {
      options.push({
        action: 'playCard',
        cardIndex: index,
        cardId: card.id,
        targetUid: null,
        score: scoreNpcTechnique(player, enemies[0], card, config)
      });
    }
  });

  options.sort((a, b) => b.score - a.score);
  const best = selectNpcOption(options, config, () => rand(1000000) / 1000000);

  if (best && (best.score >= 24 || player.ki >= 8 || hpRatio(player) < 0.42)) {
    return best;
  }
  if (player.ki < 9) return { action: 'chargeKi', score: 10 };
  if (best) return best;
  return { action: 'passTurn', score: 0 };
}

export class SquadBotController {
  constructor({ engine } = {}) {
    this.engine = engine;
    this.timers = new Map();
    this.disposed = false;
  }

  poke() {
    if (this.disposed || !this.engine || this.engine.finished) return;

    const bots = [
      ...this.engine.getTeam('A'),
      ...this.engine.getTeam('B')
    ].filter(player =>
      player.isBot &&
      !player.downed &&
      !player.abandoned
    );

    for (const bot of bots) {
      if (this.timers.has(bot.uid)) continue;

      const decisionNow = chooseSquadBotAction(this.engine, bot.uid);
      const inClash = decisionNow?.action === 'mashBeamClash';
      const inReaction = !!this.engine.getPendingFor?.(bot.uid);

      let waitForReady = 0;
      if (!inClash && !inReaction) {
        waitForReady = Math.max(
          0,
          Number(bot.actionReadyAt || 0) - Date.now()
        );
      }

      const config = npcOptionsFor(bot);
      const remaining = inReaction ? this.engine.getPendingFor(bot.uid).deadline - Date.now() : Infinity;
      const delay = inClash ? NPC_DIFFICULTIES[config.difficulty].mashMs : npcThinkDelay(config, () => rand(1000000) / 1000000, remaining);

      const timer = setTimeout(() => {
        this.timers.delete(bot.uid);
        if (this.disposed || this.engine.finished) return;

        const decision = chooseSquadBotAction(this.engine, bot.uid);
        if (decision) {
          this.engine.action(
            bot.uid,
            decision.action,
            {
              cardIndex: decision.cardIndex,
              cardId: decision.cardId,
              targetUid: decision.targetUid
            }
          );
        }

        queueMicrotask(() => this.poke());
      }, waitForReady + delay);

      timer.unref?.();
      this.timers.set(bot.uid, timer);
    }
  }

  dispose() {
    this.disposed = true;
    for (const timer of this.timers.values()) clearTimeout(timer);
    this.timers.clear();
  }
}

function scoreRaidCard(engine, player, card) {
  const rule = getCardRule(card);
  if (getEffectiveCardCost(player, card) > player.ki) return -Infinity;

  if (isAttackAction(card)) {
    let damage = Math.max(0, Number(card.power) || 0) + getLeaderAttackBonus(player, card, player.hand || []);
    damage += Math.max(0, Number(player.nextAttackBonus) || 0);
    let score = damage;
    if (damage >= engine.boss.hp) score += 1000;
    return score;
  }

  if (isImmediateTechnique(card)) {
    const missing = Math.max(0, player.maxHp - player.hp);
    let score = 10;
    if (rule.heal) score += Math.min(rule.heal, missing) * (hpRatio(player) < 0.45 ? 1.6 : 0.6);
    if (rule.kiGain) score += Math.min(rule.kiGain, 10 - player.ki) * 9;
    if (rule.draw) score += rule.draw * 12;
    if (rule.nextAttackBonus) score += rule.nextAttackBonus;
    if (rule.selfDamage) score -= rule.selfDamage * (hpRatio(player) < 0.35 ? 4 : 0.5);
    return score;
  }

  if (card.type === 'defense') return (hpRatio(player) < 0.5 ? 76 : 26) + Number(card.block || 0) * 0.7;
  if (card.type === 'evade') return hpRatio(player) < 0.5 ? 88 : 34;
  if (card.type === 'counter') return 36 + Number(rule.counterDamage || card.power || 0);
  return -Infinity;
}

export function chooseRealtimeRaidBotAction(engine, uid) {
  const player = engine?.getPlayer(uid);
  if (!player || !player.isBot || player.downed || player.abandoned || engine.finished) return null;
  if (engine.beamClashes?.has(uid)) return { action: 'mashBeamClash' };
  const config = npcOptionsFor(player);
  const reacting = engine.bossIntent?.targetUids.includes(uid) && !engine.bossIntent.respondedUids.includes(uid) && Date.now() < engine.bossIntent.deadline;
  if (!reacting && !engine.canAct(uid)) return null;
  const bossTarget = { ...engine.boss, maxHp: engine.boss.maxHp, leader: null };
  const incoming = reacting ? engine._bossAttackCard(engine.bossIntent.profile) : null;

  const options = player.hand
    .map((card, index) => {
      if (getEffectiveCardCost(player, card) > player.ki) return { card, index, score: -Infinity };
      if (reacting && canUseReaction(player, incoming, card)) return { card, index, ...scoreNpcReaction(player, bossTarget, incoming, card, config) };
      if (reacting && ['defense', 'evade', 'counter'].includes(card.type)) return { card, index, score: -Infinity };
      if (!engine.canAct(uid)) return { card, index, score: -Infinity };
      if (isAttackAction(card)) return { card, index, ...scoreNpcAttack(player, bossTarget, card, config) };
      if (isImmediateTechnique(card)) return { card, index, score: scoreNpcTechnique(player, bossTarget, card, config) };
      const alreadyPrepared = (card.type === 'defense' && player.guardBlock >= Number(card.block || 0)) || (card.type === 'evade' && player.dodgeNext) || (card.type === 'counter' && player.counterNext > 0);
      return { card, index, score: alreadyPrepared ? -Infinity : scoreRaidCard(engine, player, card) };
    })
    .filter(item => Number.isFinite(item.score))
    .sort((a, b) => b.score - a.score);

  const best = selectNpcOption(options, config, () => rand(1000000) / 1000000);
  if (best && (best.score >= 24 || player.ki >= 8 || hpRatio(player) < 0.45)) {
    return { action: 'playCard', cardIndex: best.index, cardId: best.card.id };
  }
  if (engine.canAct(uid) && player.ki < 9) return { action: 'chargeKi' };
  if (best) return { action: 'playCard', cardIndex: best.index, cardId: best.card.id };
  return engine.canAct(uid) ? { action: 'passTurn' } : null;
}

export class RaidRealtimeBotController {
  constructor({ engine } = {}) {
    this.engine = engine;
    this.timers = new Map();
    this.disposed = false;
  }

  poke() {
    if (this.disposed || !this.engine || this.engine.finished) return;
    const bots = this.engine.players.filter(player => player.isBot && !player.downed && !player.abandoned);

    for (const bot of bots) {
      if (this.timers.has(bot.uid)) continue;
      const reacting = this.engine.bossIntent?.targetUids.includes(bot.uid) && !this.engine.bossIntent.respondedUids.includes(bot.uid);
      const inClash = this.engine.beamClashes?.has(bot.uid);
      const waitForReady = reacting || inClash ? 0 : Math.max(0, Number(bot.actionReadyAt || 0) - Date.now());
      const config = npcOptionsFor(bot);
      const delay = inClash ? NPC_DIFFICULTIES[config.difficulty].mashMs : npcThinkDelay(config, () => rand(1000000) / 1000000, reacting ? this.engine.bossIntent.deadline - Date.now() : Infinity);
      const timer = setTimeout(() => {
        this.timers.delete(bot.uid);
        if (this.disposed || this.engine.finished) return;
        const decision = chooseRealtimeRaidBotAction(this.engine, bot.uid);
        if (decision) {
          if (decision.action === 'playCard') this.engine.playCard(bot.uid, decision.cardIndex, decision.cardId);
          else if (decision.action === 'chargeKi') this.engine.chargeKi(bot.uid);
          else if (decision.action === 'mashBeamClash') this.engine.mashBeamClash(bot.uid);
          else this.engine.passTurn(bot.uid);
        }
        queueMicrotask(() => this.poke());
      }, waitForReady + delay);
      timer.unref?.();
      this.timers.set(bot.uid, timer);
    }
  }

  dispose() {
    this.disposed = true;
    for (const timer of this.timers.values()) clearTimeout(timer);
    this.timers.clear();
  }
}
