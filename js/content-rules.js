export const CARD_RULES = Object.freeze({
  atk_01: { retainInitiative: true },
  atk_04: { defensePierce: 0.5 },
  atk_05: { defensePierce: 1 },
  atk_12: { unblockableDefense: true },
  atk_15: { breakShield: true },
  atk_18: { drainKi: 1 },
  atk_22: { burnDefense: 1 },

  def_02: { kiGain: 1 },
  def_04: { draw: 1 },
  def_05: { heal: 15 },
  def_06: { kiGainVsBeam: 1 },
  def_07: { reflect: 10 },
  def_10: { stealKi: 1 },
  def_12: { gainInitiative: true },
  def_14: { heal: 20 },

  evd_01: { draw: 1, stealInitiative: true },
  evd_02: { draw: 1, physicalOnly: true },
  evd_03: { kiGain: 2 },
  evd_05: { draw: 1 },
  evd_06: { kiGain: 3, draw: 2 },
  evd_07: { stealInitiative: true },
  evd_09: { stealInitiative: true },

  ctr_02: { counterDamage: 20 },
  ctr_03: { counterDamage: 25 },
  ctr_04: { counterDamage: 15, beamOnly: true },
  ctr_05: { counterDamage: 30 },
  ctr_06: { counterDamage: 22 },
  ctr_07: { counterDamage: 28 },
  ctr_08: { counterDamage: 18, physicalOnly: true },
  ctr_09: { counterDamage: 26, kiGain: 2 },

  tch_01: { selfDamage: 30, kiGain: 4, draw: 1 },
  tch_02: { heal: 50, draw: 1 },
  tch_03: { attackLike: true, reactionSeconds: 4.0 },
  tch_04: { nextAttackBonus: 25, kiGain: 2 },
  tch_05: { draw: 3 },
  tch_06: { kiGain: 5, heal: 30 },
  tch_07: { heal: 60 },
  tch_08: { draw: 2, kiGain: 1 },
  tch_09: { heal: 40, draw: 2 }
});

export const SPECIAL_RULE_IDS = Object.freeze(Object.keys(CARD_RULES));

const EXTRA_KI_ATTACK_IDS = new Set(['atk_12', 'atk_15', 'atk_22']);

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function getCardRule(cardOrId) {
  const id = typeof cardOrId === 'string' ? cardOrId : cardOrId?.id;
  return CARD_RULES[id] || {};
}

export function isAttackAction(card) {
  return !!card && (card.type === 'attack' || card.id === 'tch_03');
}

export function isImmediateTechnique(card) {
  return !!card && card.type === 'tech' && card.id !== 'tch_03';
}

export function isPhysicalAttack(card) {
  return !!card && card.type === 'attack' && card.isCombo === true;
}

export function isKiAttack(card) {
  return !!card && (card.isBeam === true || EXTRA_KI_ATTACK_IDS.has(card.id));
}

export function getEffectiveCardCost(fighter, card) {
  if (!fighter || !card) return Infinity;
  let cost = Number(card.cost || 0);
  const leaderId = fighter.leader?.id;

  if (leaderId === 'goku') {
    if (card.isCombo) cost -= 1;
    if (fighter.isAwakened && (isKiAttack(card) || card.type === 'tech')) cost -= 2;
  }

  if (leaderId === 'trunks' && card.type === 'evade') {
    cost -= 1;
  }

  return Math.max(0, cost);
}

export function getLeaderAttackBonus(fighter, card, handBeforePlay = []) {
  if (!fighter || !card || card.type !== 'attack') return 0;
  if (fighter.leader?.id !== 'vegeta') return 0;

  const attackCount = handBeforePlay.filter(c => c?.type === 'attack').length;
  return attackCount >= 3 ? 10 : 0;
}

export function getChargeAmount(actor, opponent) {
  if (!actor) return 0;
  let amount = actor.leader?.id === 'frieza' && actor.isAwakened ? 3 : 2;
  if (opponent?.leader?.id === 'frieza') amount -= 1;
  return Math.max(1, amount);
}

export function getOpenGuardDurationMs(actor, opponent) {
  if (opponent?.leader?.id === 'vegeta' && opponent.isAwakened) return 5000;
  return 3500;
}

export function getBeamMashPower(fighter) {
  if (fighter?.leader?.id === 'gohan' && fighter.isAwakened) return 11;
  return 7;
}

export function getReactionSeconds(card) {
  return Number(getCardRule(card).reactionSeconds || 3.0);
}

export function getDefenseBlockMultiplier(attacker, attackCard) {
  if (!attackCard) return 1;
  const rule = getCardRule(attackCard);
  if (rule.defensePierce === 1) return 0;
  if (rule.defensePierce === 0.5) return 0.5;
  if (attacker?.leader?.id === 'piccolo' && attacker.isAwakened && isKiAttack(attackCard)) return 0;
  return 1;
}

export function canUseReaction(defender, attackCard, reactionCard) {
  if (!defender || !attackCard || !reactionCard) return false;

  if (reactionCard.isBeam && attackCard.isBeam && isAttackAction(reactionCard)) {
    return true;
  }

  const reactionRule = getCardRule(reactionCard);
  const attackRule = getCardRule(attackCard);

  if (reactionCard.type === 'defense') {
    return !attackRule.unblockableDefense;
  }

  if (reactionCard.type === 'evade') {
    if (defender.isOpenGuard) return false;
    if (reactionRule.physicalOnly && !isPhysicalAttack(attackCard)) return false;
    return true;
  }

  if (reactionCard.type === 'counter') {
    if (reactionRule.beamOnly && !attackCard.isBeam) return false;
    if (reactionRule.physicalOnly && !isPhysicalAttack(attackCard)) return false;
    return true;
  }

  return false;
}
