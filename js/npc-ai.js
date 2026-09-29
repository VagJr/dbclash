import { canUseReaction, getCardRule, getEffectiveCardCost, getLeaderAttackBonus, getDefenseBlockMultiplier, isAttackAction, isImmediateTechnique } from './content-rules.js';

export const NPC_DIFFICULTIES = Object.freeze({
  easy: Object.freeze({ label: 'Fácil', mistakeChance: 0.45, planning: 0, thinkMin: 1100, thinkMax: 1800, mashMs: 420 }),
  normal: Object.freeze({ label: 'Normal', mistakeChance: 0.12, planning: 1, thinkMin: 650, thinkMax: 1000, mashMs: 230 }),
  hard: Object.freeze({ label: 'Difícil', mistakeChance: 0.03, planning: 2, thinkMin: 380, thinkMax: 650, mashMs: 150 }),
  expert: Object.freeze({ label: 'Expert', mistakeChance: 0, planning: 3, thinkMin: 220, thinkMax: 380, mashMs: 100 })
});

export const NPC_IDENTITIES = Object.freeze({
  goku: Object.freeze({ label: 'Goku · Combos', attack: 1.1, heal: 0.8, control: 0.8, combo: 1.5, resources: 1 }),
  vegeta: Object.freeze({ label: 'Vegeta · Pressão', attack: 1.35, heal: 0.6, control: 0.8, combo: 1.2, resources: 0.8 }),
  piccolo: Object.freeze({ label: 'Piccolo · Defesa', attack: 0.8, heal: 1.5, control: 1.1, combo: 0.8, resources: 1.3 }),
  gohan: Object.freeze({ label: 'Gohan · Despertar', attack: 1.05, heal: 0.9, control: 1, combo: 1.1, resources: 1.2 }),
  frieza: Object.freeze({ label: 'Freeza · Controle', attack: 0.9, heal: 0.75, control: 1.6, combo: 0.8, resources: 1.4 }),
  trunks: Object.freeze({ label: 'Trunks · Tempo', attack: 1, heal: 0.8, control: 1.2, combo: 1.25, resources: 1.1 })
});

export function normalizeNpcOptions(options = {}, fallbackIdentity = 'goku') {
  const difficulty = NPC_DIFFICULTIES[options.difficulty] ? options.difficulty : 'normal';
  const identity = NPC_IDENTITIES[options.identity] ? options.identity : (NPC_IDENTITIES[fallbackIdentity] ? fallbackIdentity : 'goku');
  return { difficulty, identity };
}

export function npcOptionsFor(actor, engine = null) {
  return normalizeNpcOptions({ difficulty: actor?.botDifficulty || engine?.npcOptions?.difficulty, identity: actor?.botIdentity || engine?.npcOptions?.identity }, actor?.leader?.id);
}

export function npcThinkDelay(options, rng = Math.random, reactionRemainingMs = Infinity) {
  const config = NPC_DIFFICULTIES[normalizeNpcOptions(options).difficulty];
  const delay = config.thinkMin + Math.floor(rng() * (config.thinkMax - config.thinkMin + 1));
  return Math.max(30, Math.min(delay, Number.isFinite(reactionRemainingMs) ? Math.max(30, reactionRemainingMs - 100) : delay));
}

export function selectNpcOption(options, config = {}, rng = Math.random) {
  const legal = options.filter(item => Number.isFinite(item.score)).sort((a, b) => b.score - a.score);
  if (!legal.length) return null;
  const level = NPC_DIFFICULTIES[normalizeNpcOptions(config).difficulty];
  if (level.planning >= 2 && legal[0].critical) return legal[0];
  if (legal.length > 1 && rng() < level.mistakeChance) return legal[1 + Math.floor(rng() * (legal.length - 1))];
  return legal[0];
}

export function scoreNpcAttack(actor, target, card, options = {}) {
  const config = normalizeNpcOptions(options, actor.leader?.id);
  const persona = NPC_IDENTITIES[config.identity];
  const level = NPC_DIFFICULTIES[config.difficulty];
  const rule = getCardRule(card);
  let damage = Math.max(0, Number(card.power) || 0) + getLeaderAttackBonus(actor, card, actor.hand || []) + Math.max(0, Number(actor.nextAttackBonus) || 0);
  if (target.isOpenGuard) damage = Math.floor(damage * 1.5);
  if (rule.breakShield && target.hp > 0) damage = Math.max(damage, target.hp - Math.max(0, (Math.ceil(target.hp / 50) - 1) * 50));
  let score = damage * persona.attack;
  if (damage >= target.hp) score += 10000;
  score += (rule.retainInitiative ? 30 * persona.combo : 0) + (rule.drainKi || 0) * Math.min(12, (target.ki || 0) * 4) * persona.control;
  if (rule.burnDefense) score += 18 * persona.control;
  if (rule.defensePierce || rule.unblockableDefense) score += (target.ki >= 2 ? 18 : 4) * persona.control;
  const cost = getEffectiveCardCost(actor, card);
  score -= cost * (level.planning >= 2 ? 5 : 2) * persona.resources;
  if (level.planning >= 3 && actor.ki - cost <= 1 && actor.hp < actor.maxHp * 0.4 && damage < target.hp) score -= 30;
  return { score, critical: damage >= target.hp };
}

export function scoreNpcTechnique(actor, target, card, options = {}) {
  const config = normalizeNpcOptions(options, actor.leader?.id);
  const persona = NPC_IDENTITIES[config.identity];
  const level = NPC_DIFFICULTIES[config.difficulty];
  const rule = getCardRule(card);
  if (rule.selfDamage >= actor.hp && !rule.heal) return -Infinity;
  const missing = Math.max(0, actor.maxHp - actor.hp);
  let score = 4 + Math.min(rule.heal || 0, missing) * persona.heal * (actor.hp <= actor.maxHp * 0.35 ? 2 : 0.65);
  score += Math.min(rule.kiGain || 0, 10 - actor.ki) * 11 * persona.resources;
  score += Math.min(rule.draw || 0, 7 - actor.hand.length + 1) * 13 * persona.resources;
  score += (rule.nextAttackBonus || 0) * persona.combo * 0.6;
  score -= (rule.selfDamage || 0) * (actor.hp <= (rule.selfDamage || 0) + 50 ? 6 : 0.7);
  score -= getEffectiveCardCost(actor, card) * 3;
  if (level.planning >= 2 && rule.nextAttackBonus) {
    const futureKi = Math.min(10, actor.ki - getEffectiveCardCost(actor, card) + (rule.kiGain || 0) + 1);
    const followup = actor.hand.filter(c => c !== card && isAttackAction(c) && getEffectiveCardCost(actor, c) <= futureKi);
    if (!followup.length) score -= 35;
    else if (followup.some(c => Number(c.power || 0) + rule.nextAttackBonus >= target.hp)) score += 110;
  }
  return score;
}

export function scoreNpcReaction(actor, attacker, incomingCard, card, options = {}) {
  const config = normalizeNpcOptions(options, actor.leader?.id);
  const persona = NPC_IDENTITIES[config.identity];
  const rule = getCardRule(card);
  let incoming = Math.max(0, Number(incomingCard.resolvedPower ?? incomingCard.power) || 0);
  if (actor.isOpenGuard) incoming = Math.floor(incoming * 1.5);
  if (getCardRule(incomingCard).breakShield && actor.hp > 0) incoming = Math.max(incoming, actor.hp - Math.max(0, (Math.ceil(actor.hp / 50) - 1) * 50));
  let net = incoming;
  let score = 0;
  if (card.type === 'evade') { net = 0; score = incoming + 25 * persona.combo; }
  else if (card.type === 'counter') { net = 0; score = incoming + Number(rule.counterDamage || card.power || 0) * persona.attack; }
  else if (card.type === 'defense') {
    const block = ((Number(card.block) || 0) + (actor.leader?.id === 'piccolo' ? 15 : 0)) * getDefenseBlockMultiplier(attacker, incomingCard);
    net = Math.max(0, incoming - block);
    score = incoming - net + Math.min(rule.heal || 0, actor.maxHp - actor.hp + net) * persona.heal;
    if (getCardRule(incomingCard).breakShield) net = Math.max(net, actor.hp - Math.max(0, (Math.ceil(actor.hp / 50) - 1) * 50));
  } else if (card.isBeam && incomingCard.isBeam) { score = Number(card.power || 0) * 0.6 + incoming * 0.65; }
  const survives = actor.hp - net + Number(rule.heal || 0) > 0;
  const critical = incoming >= actor.hp && survives && !card.isBeam;
  if (critical) score += 10000;
  if (card.type === 'counter' && Number(rule.counterDamage || card.power || 0) >= attacker.hp) score += 12000;
  score += (rule.draw || 0) * 9 * persona.resources + (rule.kiGain || 0) * 8 + (rule.reflect || 0) + (rule.stealKi || 0) * 10 * persona.control;
  score -= getEffectiveCardCost(actor, card) * 4;
  return { score, critical };
}

export function chooseNpcDuelAction(engine, actorKey = 'opponent', rng = Math.random) {
  if (!engine || engine.state === 'GAME_OVER' || !['player', 'opponent'].includes(actorKey)) return null;
  const actor = engine[actorKey];
  const enemyKey = actorKey === 'player' ? 'opponent' : 'player';
  const enemy = engine[enemyKey];
  if (!actor || !enemy || actor.hp <= 0) return null;
  const options = npcOptionsFor(actor, engine);
  if (engine.state === 'BEAM_CLASH') return { action: 'mashBeamClash' };
  const reacting = engine.state === 'ATTACK_PENDING' && engine.pendingAttack?.attackerKey === enemyKey;
  if (!reacting && (engine.state !== 'FREE_ACTION' || engine.initiative !== actorKey)) return null;
  const candidates = [];
  for (let index = 0; index < actor.hand.length; index++) {
    const card = actor.hand[index];
    if (!card || getEffectiveCardCost(actor, card) > actor.ki) continue;
    if (reacting) {
      if (!canUseReaction(actor, engine.pendingAttack.card, card)) continue;
      candidates.push({ action: 'playCard', cardIndex: index, cardId: card.id, ...scoreNpcReaction(actor, enemy, engine.pendingAttack.card, card, options) });
    } else if (isAttackAction(card)) candidates.push({ action: 'playCard', cardIndex: index, cardId: card.id, ...scoreNpcAttack(actor, enemy, card, options) });
    else if (isImmediateTechnique(card)) candidates.push({ action: 'playCard', cardIndex: index, cardId: card.id, score: scoreNpcTechnique(actor, enemy, card, options) });
  }
  if (!reacting) {
    if (actor.ki < 10) candidates.push({ action: 'chargeKi', score: actor.ki <= 2 ? 36 : 8 });
    candidates.push({ action: 'passTurn', score: 0 });
  }
  return selectNpcOption(candidates, options, rng);
}
