import os
import re

def apply_all_fixes():
    # 1. Update js/game-engine.js
    ge_path = 'c:/dbtcg/js/game-engine.js'
    with open(ge_path, 'r', encoding='utf-8') as f:
        ge = f.read()

    # Refined getTarget with zero self/ally damage
    new_get_target = """  getTarget(attackerKey) {
    const isAttackerTeamA = attackerKey === 'p1' || attackerKey === 'p3' || attackerKey === 'p5' || attackerKey === 'p6' || attackerKey === 'player';
    
    if (isAttackerTeamA) {
      // Attacker is Team A -> Target MUST be Team B (p2 or p4)
      if (this.selectedTargetKey && (this.selectedTargetKey === 'p2' || this.selectedTargetKey === 'p4' || this.selectedTargetKey === 'opponent')) {
        const sel = this[this.selectedTargetKey];
        if (sel && sel.hp > 0) return this.selectedTargetKey;
      }
      if (this.p2 && this.p2.hp > 0) return 'p2';
      if (this.p4 && this.p4.hp > 0) return 'p4';
      return 'p2';
    } else {
      // Attacker is Team B (p2, p4, opponent) -> Target MUST be Team A (p1, p3, p5, p6)
      const aliveTeamA = ['p1', 'p3', 'p5', 'p6'].filter(k => this[k] && this[k].hp > 0);
      if (aliveTeamA.length > 0) {
        return aliveTeamA[Math.floor(Math.random() * aliveTeamA.length)];
      }
      return 'p1';
    }
  }"""

    # Replace getTarget method in ge
    pattern_gt = r'  getTarget\(attackerKey\) \{[\s\S]*?\n  \}'
    ge = re.sub(pattern_gt, new_get_target, ge, count=1)

    # Update _passTurn in ge
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
    print("Updated game-engine.js getTarget and _passTurn!")

    # 2. Update js/multiplayer-manager.js to ensure p1 = player, p2 = opponent
    mp_path = 'c:/dbtcg/js/multiplayer-manager.js'
    with open(mp_path, 'r', encoding='utf-8') as f:
        mp = f.read()

    new_2v2_fallback = """  fallbackToBot2v2(pLeader, finalDeck) {
    this.clearMatchmaking();
    const mmModal = document.getElementById('matchmaking-modal');
    if (mmModal) mmModal.classList.remove('active');

    if (typeof uiManager !== 'undefined' && uiManager) {
      uiManager.triggerActionBanner('DUETO 2V2 INICIADO!', 'act-attack', 'TIME A VS TIME B');
    }

    this.engine.multiplayerMode = '2v2';
    this.engine.startMatch(pLeader, 'vegeta', finalDeck, true);

    // Set 2v2 Entities
    this.engine.p1 = this.engine.player; // Team A Member 1 (You)
    this.engine.p2 = this.engine.opponent; // Team B Member 1 (Vegeta)
    this.engine.p3 = { name: 'Gohan (Parceiro)', leader: { ...LEADERS.gohan }, hp: 400, maxHp: 400, shields: 8, ki: 4, isAwakened: false, hand: [], deck: getStarterDeckForLeader('gohan') }; // Team A Member 2
    this.engine.p4 = { name: 'Frieza (Oponente 2)', leader: { ...LEADERS.frieza }, hp: 400, maxHp: 400, shields: 8, ki: 5, isAwakened: false, hand: [], deck: getStarterDeckForLeader('frieza') }; // Team B Member 2

    // Turn rotation: Team 1 P1 -> Team 2 P1 -> Team 1 P2 -> Team 2 P2
    this.engine.turnOrder = ['p1', 'p2', 'p3', 'p4'];

    sceneManager.switchScene(GAME_SCENES.ARENA);
    this.engine.notifyState();
  }"""

    pattern_2v2 = r'  fallbackToBot2v2\(pLeader, finalDeck\) \{[\s\S]*?\n  \}'
    mp = re.sub(pattern_2v2, new_2v2_fallback, mp, count=1)

    new_raid_fallback = """  fallbackToBotRaid(bossId = 'cell_max', pLeader, finalDeck) {
    this.clearMatchmaking();
    const mmModal = document.getElementById('matchmaking-modal');
    if (mmModal) mmModal.classList.remove('active');

    const bossData = RAID_BOSSES[bossId] || RAID_BOSSES.cell_max;

    if (typeof uiManager !== 'undefined' && uiManager) {
      uiManager.triggerActionBanner(`MODO RAID CO-OP: ${bossData.name.toUpperCase()}`, 'act-attack', '4 GUERREIROS Z VS CHEFÃO GIGANTE');
    }

    this.engine.multiplayerMode = 'raid';
    this.engine.startMatch(pLeader, 'frieza', finalDeck, true);

    // Configure Opponent as 2000 HP Raid Boss (Top UI - p2)
    this.engine.opponent = {
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

    this.engine.p1 = this.engine.player; // You
    this.engine.p2 = this.engine.opponent; // Boss Cell Max
    this.engine.p3 = { name: 'Vegeta (P2)', leader: { ...LEADERS.vegeta }, hp: 400, maxHp: 400, shields: 8, ki: 4, isAwakened: false, hand: [], deck: getStarterDeckForLeader('vegeta') };
    this.engine.p5 = { name: 'Gohan (P3)', leader: { ...LEADERS.gohan }, hp: 400, maxHp: 400, shields: 8, ki: 4, isAwakened: false, hand: [], deck: getStarterDeckForLeader('gohan') };
    this.engine.p6 = { name: 'Trunks (P4)', leader: { ...LEADERS.trunks }, hp: 400, maxHp: 400, shields: 8, ki: 4, isAwakened: false, hand: [], deck: getStarterDeckForLeader('trunks') };

    // Turn order: 4 Warriors -> Boss
    this.engine.turnOrder = ['p1', 'p3', 'p5', 'p6', 'p2'];

    sceneManager.switchScene(GAME_SCENES.ARENA);
    this.engine.notifyState();
  }"""

    pattern_raid = r'  fallbackToBotRaid\(bossId = \'cell_max\', pLeader, finalDeck\) \{[\s\S]*?\n  \}'
    mp = re.sub(pattern_raid, new_raid_fallback, mp, count=1)

    with open(mp_path, 'w', encoding='utf-8') as f:
        f.write(mp)
    print("Updated multiplayer-manager.js fallbacks!")

    # 3. Update styles/arena.css for Mobile Layout & 100dvh height
    css_path = 'c:/dbtcg/styles/arena.css'
    with open(css_path, 'r', encoding='utf-8') as f:
        css = f.read()

    mobile_height_css = """

/* ==========================================================================
   MOBILE FULL VIEWPORT HEIGHT & PERFECT RESPONSIVE FIT
   ========================================================================== */
#scene-arena {
  display: flex !important;
  flex-direction: column !important;
  justify-content: space-between !important;
  height: 100vh !important;
  height: 100dvh !important;
  max-height: 100vh !important;
  max-height: 100dvh !important;
  overflow: hidden !important;
  box-sizing: border-box !important;
  padding: env(safe-area-inset-top, 8px) 8px env(safe-area-inset-bottom, 8px) 8px !important;
}

.arena-zone-mid {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  min-height: 0;
}

.arena-zone-bot {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
}

@media (max-width: 768px) {
  #scene-arena {
    padding: 6px 4px 6px 4px !important;
  }
  
  /* Raid Mode: 4 Warriors in 2x2 Grid at bottom */
  .arena-mode-raid .bot-hud-container {
    display: grid !important;
    grid-template-columns: 1fr 1fr !important;
    grid-template-rows: auto auto !important;
    gap: 4px 6px !important;
    width: 100% !important;
    padding: 0 !important;
    box-sizing: border-box !important;
  }

  .arena-mode-raid .bot-hud-container .fighter-hud {
    width: 100% !important;
    max-width: 100% !important;
    padding: 4px !important;
  }

  /* 2v2 Mode Mobile: 2 Top, 2 Bottom cleanly spaced */
  .arena-mode-2v2 .scouter-hud-container {
    display: flex !important;
    flex-direction: row !important;
    justify-content: space-between !important;
    gap: 6px !important;
    width: 100% !important;
  }

  .arena-mode-2v2 .scouter-hud-container .fighter-hud {
    flex: 1 !important;
    max-width: 48% !important;
    padding: 4px 6px !important;
  }

  .hand-zone {
    padding: 4px 0 !important;
    gap: 4px !important;
  }
}
"""

    if '#scene-arena {' not in css or '100dvh' not in css:
        css += mobile_height_css

    with open(css_path, 'w', encoding='utf-8') as f:
        f.write(css)
    print("Updated arena.css mobile height and flex layout!")

if __name__ == '__main__':
    apply_all_fixes()
