/* ==========================================================================
   Dragon Ball Clash Action TCG — Co-Op Raid Boss Engine (3-4 Players)
   Cell Max (2000 HP), Broly SSJ (2500 HP), Jiren Full Power (1800 HP)
   ========================================================================== */

export const RAID_BOSSES = {
  cell_max: {
    id: 'cell_max',
    name: 'CELL MAX (Chefe Gigante)',
    hp: 2000,
    maxHp: 2000,
    enrageThresholds: [0.75, 0.50, 0.25],
    color: '#ff0055',
    portrait: 'assets/leaders/frieza_awaken.png',
    ultimateAttack: 'DISPARO DE ENERGIA DESTRUTIVA MAX',
    ultimateDamage: 120
  },
  broly: {
    id: 'broly',
    name: 'BROLY (SSJ Poder Total)',
    hp: 2500,
    maxHp: 2500,
    enrageThresholds: [0.75, 0.50, 0.25],
    color: '#00ff41',
    portrait: 'assets/leaders/goku_awaken.png',
    ultimateAttack: 'GIGANTIC ROAR EXPLOSIVO',
    ultimateDamage: 140
  },
  jiren: {
    id: 'jiren',
    name: 'JIREN (Poder Total Absoluto)',
    hp: 1800,
    maxHp: 1800,
    enrageThresholds: [0.75, 0.50, 0.25],
    color: '#ff9500',
    portrait: 'assets/leaders/vegeta_awaken.png',
    ultimateAttack: 'IMPACT MAGNETO SUPREMO',
    ultimateDamage: 130
  }
};

export class RaidEngine {
  constructor(gameEngine) {
    this.engine = gameEngine;
    this.boss = null;
    this.players = [];
    this.turnIndex = 0;
    this.activeRaid = false;
  }

  startRaid(bossId = 'cell_max', teamLeaderKeys = ['goku', 'vegeta', 'gohan'], gameEngine = null) {
    if (gameEngine) this.engine = gameEngine;
    const template = RAID_BOSSES[bossId] || RAID_BOSSES.cell_max;
    this.boss = { ...template, hp: template.maxHp };
    this.players = teamLeaderKeys.map((key, i) => ({
      id: `p${i + 1}`,
      name: `Guerreiro Z ${i + 1} (${key.toUpperCase()})`,
      leaderKey: key,
      hp: 400,
      maxHp: 400,
      ki: 4
    }));
    this.turnIndex = 0;
    this.activeRaid = true;
    if (this.engine && typeof this.engine.log === 'function') {
      this.engine.log(`🔥 RAID COOPERATIVO INICIADO! Batalha contra ${this.boss.name}!`, 'info');
    }
    return this.boss;
  }

  executeRaidBossTurn() {
    if (!this.activeRaid || !this.boss) return;
    const targetPlayer = this.players[this.turnIndex % this.players.length];
    const isEnraged = (this.boss.hp / this.boss.maxHp) <= 0.5;
    const dmg = isEnraged ? Math.floor(this.boss.ultimateDamage * 0.8) : 45;

    targetPlayer.hp = Math.max(0, targetPlayer.hp - dmg);
    this.engine.log(`🐉 Chefe ${this.boss.name} usou ${isEnraged ? this.boss.ultimateAttack : 'Ataque de Energia'} e causou ${dmg} de dano em ${targetPlayer.name}!`, 'damage');

    this.turnIndex += 1;
  }
}

export const raidEngine = new RaidEngine();
