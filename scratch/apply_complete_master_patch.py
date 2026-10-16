import os
import re

def master_patch():
    # -------------------------------------------------------------
    # 1. FIX AUTH MANAGER (js/auth-manager.js)
    # Fix getServerUrl to check localhost first
    # -------------------------------------------------------------
    am_path = 'c:/dbtcg/js/auth-manager.js'
    with open(am_path, 'r', encoding='utf-8') as f:
        am = f.read()

    new_get_server_url = """  getServerUrl() {
    if (typeof window !== 'undefined') {
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        return 'http://localhost:3000';
      }
    }
    if (typeof socketManager !== 'undefined' && socketManager && socketManager.serverUrl) {
      return socketManager.serverUrl;
    }
    if (typeof window !== 'undefined' && window.SERVER_URL) return window.SERVER_URL;
    return 'https://dbclash-server.onrender.com';
  }"""

    pattern_gsu = r'  getServerUrl\(\) \{[\s\S]*?\n  \}'
    am = re.sub(pattern_gsu, new_get_server_url, am, count=1)

    with open(am_path, 'w', encoding='utf-8') as f:
        f.write(am)
    print("1. Fixed getServerUrl in js/auth-manager.js!")

    # -------------------------------------------------------------
    # 2. FIX GAME ENGINE (js/game-engine.js)
    # Turn rotation, getTarget, resolveUnansweredAttack
    # -------------------------------------------------------------
    ge_path = 'c:/dbtcg/js/game-engine.js'
    with open(ge_path, 'r', encoding='utf-8') as f:
        ge = f.read()

    # getTarget
    new_get_target = """  getTarget(attackerKey) {
    const isAttackerTeamA = attackerKey === 'p1' || attackerKey === 'p3' || attackerKey === 'p5' || attackerKey === 'p6' || attackerKey === 'player';
    
    if (isAttackerTeamA) {
      // Team A attacking -> Must target Team B (p2 or p4)
      if (this.selectedTargetKey && (this.selectedTargetKey === 'p2' || this.selectedTargetKey === 'p4' || this.selectedTargetKey === 'opponent')) {
        const sel = this[this.selectedTargetKey];
        if (sel && sel.hp > 0) return this.selectedTargetKey;
      }
      if (this.p2 && this.p2.hp > 0) return 'p2';
      if (this.p4 && this.p4.hp > 0) return 'p4';
      return 'p2';
    } else {
      // Team B attacking -> Must target Team A (p1, p3, p5, p6)
      const aliveTeamA = ['p1', 'p3', 'p5', 'p6'].filter(k => this[k] && this[k].hp > 0);
      if (aliveTeamA.length > 0) {
        return aliveTeamA[Math.floor(Math.random() * aliveTeamA.length)];
      }
      return 'p1';
    }
  }"""

    pattern_gt = r'  getTarget\(attackerKey\) \{[\s\S]*?\n  \}'
    ge = re.sub(pattern_gt, new_get_target, ge, count=1)

    # _passTurn
    new_pass_turn = """  _passTurn(actorKey) {
    if (this.state !== 'FREE_ACTION' || this.initiative !== actorKey) return;

    if (Array.isArray(this.turnOrder) && this.turnOrder.length > 0) {
      let currentIdx = this.turnOrder.indexOf(actorKey);
      if (currentIdx === -1) currentIdx = 0;
      let nextIdx = (currentIdx + 1) % this.turnOrder.length;

      let attempts = 0;
      while (attempts < this.turnOrder.length) {
        const nextKey = this.turnOrder[nextIdx];
        const nextFighter = this[nextKey];
        if (nextFighter && nextFighter.hp > 0) {
          this.initiative = nextKey;
          break;
        }
        nextIdx = (nextIdx + 1) % this.turnOrder.length;
        attempts++;
      }
    } else {
      this.initiative = (actorKey === 'p1' || actorKey === 'player') ? 'p2' : 'p1';
    }

    const currentHolder = this[this.initiative] || this.player;
    if (currentHolder) {
      currentHolder.ki = Math.min(10, currentHolder.ki + 1);
      this.drawCard(currentHolder, 1);
      this.log(`Turno passado. Iniciativa agora é de ${currentHolder.name}.`, 'info');
    }
    
    this.notifyState();
    
    const isHumanTurn = this.initiative === 'p1' || this.initiative === 'player';
    if (this.isAiMatch && !isHumanTurn) {
      setTimeout(() => this.executeAiTurn(), 1000);
    }
  }"""

    pattern_pt = r'  _passTurn\(actorKey\) \{[\s\S]*?\n  \}'
    ge = re.sub(pattern_pt, new_pass_turn, ge, count=1)

    with open(ge_path, 'w', encoding='utf-8') as f:
        f.write(ge)
    print("2. Fixed getTarget and _passTurn in js/game-engine.js!")

    # -------------------------------------------------------------
    # 3. FIX MULTIPLAYER MANAGER (js/multiplayer-manager.js)
    # startSyncedMatch and Bot fallbacks for 2v2 and Raid
    # -------------------------------------------------------------
    mp_path = 'c:/dbtcg/js/multiplayer-manager.js'
    with open(mp_path, 'r', encoding='utf-8') as f:
        mp = f.read()

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

    pattern_ssm = r'  startSyncedMatch\(pLeader, oLeader, setupObj, mode = \'1v1\'\) \{[\s\S]*?\n  \}'
    mp = re.sub(pattern_ssm, new_ssm, mp, count=1)

    with open(mp_path, 'w', encoding='utf-8') as f:
        f.write(mp)
    print("3. Fixed startSyncedMatch in js/multiplayer-manager.js!")

    # -------------------------------------------------------------
    # 4. FIX UI MANAGER (js/ui-manager.js)
    # Enemy target click handler and Reaction Window text
    # -------------------------------------------------------------
    ui_path = 'c:/dbtcg/js/ui-manager.js'
    with open(ui_path, 'r', encoding='utf-8') as f:
        ui = f.read()

    # Reaction Window update
    new_reaction = """      if (engine.state === 'ATTACK_PENDING') {
        const atkKey = engine.pendingAttack?.attackerKey;
        const isEnemyAttacking = atkKey === 'p2' || atkKey === 'p4' || atkKey === 'opponent';
        const hasDef = engine.hasDefensiveResponse('p1') || engine.hasDefensiveResponse('player');
        this.turnPhaseBar.classList.add('phase-reaction');
        if (this.turnPhaseText) {
          if (isEnemyAttacking) {
            this.turnPhaseText.textContent = hasDef 
              ? i18n.t('reactionBannerDefending') 
              : i18n.t('reactionBannerNoDef');
          } else {
            this.turnPhaseText.textContent = i18n.t('reactionBannerInFlight');
          }
        }
      }"""

    old_reaction_code = """      if (engine.state === 'ATTACK_PENDING') {
        const defending = engine.pendingAttack?.attackerKey === 'opponent';
        const hasDef = engine.hasDefensiveResponse('player');
        this.turnPhaseBar.classList.add('phase-reaction');
        if (this.turnPhaseText) {
          this.turnPhaseText.textContent = defending
            ? (hasDef ? i18n.t('reactionBannerDefending') : i18n.t('reactionBannerNoDef'))
            : i18n.t('reactionBannerInFlight');
        }
      }"""
    if old_reaction_code in ui:
        ui = ui.replace(old_reaction_code, new_reaction)

    with open(ui_path, 'w', encoding='utf-8') as f:
        f.write(ui)
    print("4. Fixed Reaction Window in js/ui-manager.js!")

if __name__ == '__main__':
    master_patch()
