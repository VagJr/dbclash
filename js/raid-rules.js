import { getCardById } from './card-database.js';

export const RAID_MIN_PLAYERS = 3;
export const RAID_MAX_PLAYERS = 4;
export const RAID_QUEUE_FILL_MS = 5000;
export const RAID_TURN_MS = 30000;
export const RAID_RECONNECT_GRACE_MS = 30000;

export const RAID_BOSSES = Object.freeze({
  cell_max: {
    id: 'cell_max',
    name: 'CELL MAX',
    maxHp: 2000,
    baseDamage: 45,
    ultimateDamage: 120,
    ultimateAttack: 'DISPARO DE ENERGIA DESTRUTIVA MAX',
    color: '#ff0055',
    reward: { zeni: 600, xp: 200, trophies: 1, gems: 0 }
  },
  broly: {
    id: 'broly',
    name: 'BROLY SSJ PODER TOTAL',
    maxHp: 2500,
    baseDamage: 50,
    ultimateDamage: 140,
    ultimateAttack: 'GIGANTIC ROAR EXPLOSIVO',
    color: '#00ff41',
    reward: { zeni: 850, xp: 275, trophies: 2, gems: 1 }
  },
  jiren: {
    id: 'jiren',
    name: 'JIREN PODER TOTAL',
    maxHp: 1800,
    baseDamage: 55,
    ultimateDamage: 130,
    ultimateAttack: 'IMPACTO SUPREMO',
    color: '#ff9500',
    reward: { zeni: 750, xp: 300, trophies: 2, gems: 1 }
  }
});

export function getRaidBoss(bossId) {
  return RAID_BOSSES[bossId] || RAID_BOSSES.cell_max;
}

export function raidPhaseForHp(hp, maxHp) {
  const ratio = Math.max(0, Number(hp) || 0) / Math.max(1, Number(maxHp) || 1);
  if (ratio <= 0.25) return 4;
  if (ratio <= 0.50) return 3;
  if (ratio <= 0.75) return 2;
  return 1;
}

export function raidBossAttackProfile(boss, phase, round) {
  const base = Math.max(1, Number(boss.baseDamage) || 45);
  if (round > 0 && round % 3 === 0) {
    return {
      mode: 'all',
      damage: Math.max(base, Number(boss.ultimateDamage) || base),
      name: boss.ultimateAttack || 'ULTIMATE'
    };
  }

  if (phase >= 4) return { mode: 'all', damage: Math.floor(base * 1.75), name: 'ENRAGE TOTAL' };
  if (phase === 3) return { mode: 'two', damage: Math.floor(base * 1.45), name: 'ATAQUE FURIOSO' };
  if (phase === 2) return { mode: 'one', damage: Math.floor(base * 1.20), name: 'ATAQUE POTENCIALIZADO' };
  return { mode: 'one', damage: base, name: 'ATAQUE DE ENERGIA' };
}

export function raidRewardForBoss(bossId) {
  return { ...getRaidBoss(bossId).reward };
}

export function summarizeRaidCard(cardId) {
  const card = getCardById(cardId);
  if (!card) return null;
  return {
    id: card.id,
    name: card.name,
    type: card.type,
    cost: card.cost,
    power: card.power || 0,
    block: card.block || 0,
    rarity: card.rarity
  };
}
