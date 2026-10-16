import os

def apply_fixes():
    # 1. Fix game-engine.js: Add getTarget method
    ge_path = 'c:/dbtcg/js/game-engine.js'
    with open(ge_path, 'r', encoding='utf-8') as f:
        ge = f.read()

    get_target_method = """  getTarget(attackerKey) {
    if (this.multiplayerMode === 'raid') {
      if (attackerKey === 'p2' || attackerKey === 'opponent') {
        const heroes = ['p1', 'p3', 'p5', 'p6'].filter(k => this[k] && this[k].hp > 0);
        return heroes[Math.floor(Math.random() * heroes.length)] || 'p1';
      }
      return 'p2'; // All players target Boss (p2)
    } else if (this.multiplayerMode === '2v2') {
      const isTeamA = attackerKey === 'p1' || attackerKey === 'p3' || attackerKey === 'player';
      if (isTeamA) {
        return (this.p2 && this.p2.hp > 0) ? 'p2' : 'p4';
      } else {
        return (this.p1 && this.p1.hp > 0) ? 'p1' : 'p3';
      }
    }
    return (attackerKey === 'player' || attackerKey === 'p1') ? 'p2' : 'p1';
  }
"""

    if 'getTarget(attackerKey)' not in ge:
        # Insert getTarget before executeAiTurn
        idx = ge.find('executeAiTurn()')
        if idx != -1:
            ge = ge[:idx] + get_target_method + "\n  " + ge[idx:]

    with open(ge_path, 'w', encoding='utf-8') as f:
        f.write(ge)
    print("Fixed getTarget in game-engine.js!")

    # 2. Fix multiplayer-manager.js: startSyncedMatch 4-player setup
    mp_path = 'c:/dbtcg/js/multiplayer-manager.js'
    with open(mp_path, 'r', encoding='utf-8') as f:
        mp = f.read()

    old_ssm = """  startSyncedMatch(pLeader, oLeader, setupObj, mode = '1v1') {
    this.engine.multiplayerMode = mode;
    this.engine.startMatch(pLeader, oLeader, [], false, setupObj);
    sceneManager.switchScene(GAME_SCENES.ARENA);
    this.engine.notifyState();
  }"""

    new_ssm = """  startSyncedMatch(pLeader, oLeader, setupObj, mode = '1v1') {
    this.engine.multiplayerMode = mode;
    this.engine.startMatch(pLeader, oLeader, [], false, setupObj);

    if (mode === '2v2') {
      this.engine.p1 = this.engine.player;
      this.engine.p2 = this.engine.opponent;
      this.engine.p3 = { name: 'Gohan (Aliado)', leader: { ...LEADERS.gohan }, hp: 400, maxHp: 400, shields: 8, ki: 4, isAwakened: false, hand: [], deck: getStarterDeckForLeader('gohan') };
      this.engine.p4 = { name: 'Frieza (Oponente 2)', leader: { ...LEADERS.frieza }, hp: 400, maxHp: 400, shields: 8, ki: 5, isAwakened: false, hand: [], deck: getStarterDeckForLeader('frieza') };
      this.engine.turnOrder = ['p1', 'p2', 'p3', 'p4'];
    } else if (mode === 'raid') {
      const bossData = RAID_BOSSES.cell_max;
      this.engine.p2 = {
        name: bossData.name,
        leader: {
          id: bossData.id,
          name: bossData.name,
          awakenedName: `${bossData.name} (FÚRIA TOTAL)`,
          maxHp: bossData.hp,
          color: bossData.color,
          awakenThresholdHp: Math.floor(bossData.hp * 0.5)
        },
        hp: bossData.hp,
        maxHp: bossData.hp,
        shields: 12,
        ki: 6,
        isAwakened: false,
        isOpenGuard: false,
        hand: [],
        deck: getStarterDeckForLeader('frieza')
      };
      this.engine.p1 = this.engine.player;
      this.engine.p3 = { name: 'Vegeta (P2)', leader: { ...LEADERS.vegeta }, hp: 400, maxHp: 400, shields: 8, ki: 4, isAwakened: false, hand: [], deck: getStarterDeckForLeader('vegeta') };
      this.engine.p5 = { name: 'Gohan (P3)', leader: { ...LEADERS.gohan }, hp: 400, maxHp: 400, shields: 8, ki: 4, isAwakened: false, hand: [], deck: getStarterDeckForLeader('gohan') };
      this.engine.p6 = { name: 'Trunks (P4)', leader: { ...LEADERS.trunks }, hp: 400, maxHp: 400, shields: 8, ki: 4, isAwakened: false, hand: [], deck: getStarterDeckForLeader('trunks') };
      this.engine.turnOrder = ['p1', 'p3', 'p5', 'p6', 'p2'];
    } else {
      this.engine.p1 = this.engine.player;
      this.engine.p2 = this.engine.opponent;
      this.engine.turnOrder = ['p1', 'p2'];
    }

    sceneManager.switchScene(GAME_SCENES.ARENA);
    this.engine.notifyState();
  }"""

    mp = mp.replace(old_ssm, new_ssm)

    with open(mp_path, 'w', encoding='utf-8') as f:
        f.write(mp)
    print("Updated startSyncedMatch in multiplayer-manager.js!")

if __name__ == '__main__':
    apply_fixes()
