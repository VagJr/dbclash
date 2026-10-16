import os
import re

def patch_game_engine():
    filepath = 'c:/dbtcg/js/game-engine.js'
    with open(filepath, 'r', encoding='utf-8') as f:
        js = f.read()

    # 1. Update _passTurn
    old_pass = """  _passTurn(actorKey) {
    if (this.state !== 'FREE_ACTION' || this.initiative !== actorKey) return;
    this.initiative = actorKey === 'player' ? 'opponent' : 'player';
    const currentHolder = this[this.initiative];
    currentHolder.ki = Math.min(10, currentHolder.ki + 1);
    this.drawCard(currentHolder, 1);
    this.log(`Turno passado. Iniciativa agora é de ${currentHolder.name}.`, 'info');
    
    this.notifyState();
    if (this.isAiMatch && this.initiative === 'opponent') {
      setTimeout(() => this.executeAiTurn(), 1000);
    }
  }"""

    new_pass = """  _passTurn(actorKey) {
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
    if (this.isAiMatch && this.initiative !== 'p1' && this.initiative !== 'player') {
      setTimeout(() => this.executeAiTurn(), 1000);
    }
  }"""

    js = js.replace(old_pass, new_pass)

    # 2. Update getTarget
    old_target = """  getTarget(attackerKey) {
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
  }"""

    new_target = """  getTarget(attackerKey) {
    if (this.selectedTargetKey && this[this.selectedTargetKey] && this[this.selectedTargetKey].hp > 0) {
      // Validate selected target is actually an opponent of attacker
      const isAttackerTeamA = attackerKey === 'p1' || attackerKey === 'p3' || attackerKey === 'p5' || attackerKey === 'p6' || attackerKey === 'player';
      const isTargetTeamB = this.selectedTargetKey === 'p2' || this.selectedTargetKey === 'p4' || this.selectedTargetKey === 'opponent';
      if (isAttackerTeamA === isTargetTeamB) {
        return this.selectedTargetKey;
      }
    }

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
  }"""

    js = js.replace(old_target, new_target)

    # 3. Update resolveUnansweredAttack
    old_rua = """    const { attackerKey, card } = this.pendingAttack;
    const attacker = attackerKey === 'player' ? this.player : this.opponent;
    const defender = attackerKey === 'player' ? this.opponent : this.player;"""

    new_rua = """    const { attackerKey, card, targetKey } = this.pendingAttack;
    const attacker = this[attackerKey] || (attackerKey === 'player' ? this.player : this.opponent);
    const actualTargetKey = targetKey || this.getTarget(attackerKey);
    const defender = this[actualTargetKey] || (attackerKey === 'player' ? this.opponent : this.player);"""

    js = js.replace(old_rua, new_rua)

    # 4. Update _playCard pendingAttack line
    old_pa = """        this.pendingAttack = { attackerKey: actorKey, card };"""
    new_pa = """        const targetKey = this.getTarget(actorKey);
        this.pendingAttack = { attackerKey: actorKey, targetKey, card };"""

    js = js.replace(old_pa, new_pa)

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(js)
    print("Patched game-engine.js turn rotation and targeting logic successfully!")

if __name__ == '__main__':
    patch_game_engine()
