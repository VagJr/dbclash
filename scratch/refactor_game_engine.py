import os
import re

def refactor_game_engine():
    filepath = 'c:/dbtcg/js/game-engine.js'
    with open(filepath, 'r', encoding='utf-8') as f:
        js = f.read()

    # 1. Add getTarget() helper
    target_helper = """
  // Retorna o alvo inimigo baseado em quem está atacando
  getTarget(attackerKey) {
    if (this.multiplayerMode === 'raid') {
      if (attackerKey === 'opponent') {
        // Boss ataca um aliado vivo aleatório
        const allies = ['player', 'ally', 'ally2', 'ally3'].filter(k => this[k] && this[k].hp > 0);
        return allies[Math.floor(Math.random() * allies.length)] || 'player';
      } else {
        return 'opponent'; // Jogadores sempre atacam o boss
      }
    } else if (this.multiplayerMode === '2v2') {
      const isTeam1 = attackerKey === 'player' || attackerKey === 'ally';
      if (isTeam1) {
        return (this.opponent && this.opponent.hp > 0) ? 'opponent' : 'ally2'; // ally2 é o subOpponent
      } else {
        return (this.player && this.player.hp > 0) ? 'player' : 'ally';
      }
    }
    // Default 1v1
    return attackerKey === 'player' ? 'opponent' : 'player';
  }
"""

    if "getTarget(attackerKey)" not in js:
        js = js.replace("startMatch(playerLeaderKey", target_helper + "\n  startMatch(playerLeaderKey")

    # 2. _chargeKi
    js = js.replace(
        "const actor = actorKey === 'player' ? this.player : this.opponent;",
        "const actor = this[actorKey] || (actorKey === 'player' ? this.player : this.opponent);"
    )

    # 3. resolveUnansweredAttack
    old_res = """    const attacker = attackerKey === 'player' ? this.player : this.opponent;
    const defender = attackerKey === 'player' ? this.opponent : this.player;"""
    
    new_res = """    const attacker = this[attackerKey];
    const defKey = this.getTarget(attackerKey);
    const defender = this[defKey];"""
    
    js = js.replace(old_res, new_res)

    # 4. applyResolvedAttack
    old_apply = """    const defender = atkKey === 'player' ? this.player : this.opponent;"""
    new_apply = """    const defKey = this.getTarget(atkKey);
    const defender = this[defKey];"""
    js = js.replace(old_apply, new_apply)

    # 5. applyResolvedAttack - Passives
    old_apply_passives = """      const attacker = atkKey === 'player' ? this.opponent : this.player;"""
    new_apply_passives = """      const attacker = this[atkKey];"""
    js = js.replace(old_apply_passives, new_apply_passives)

    # 6. resolveReaction
    old_react = """    const attacker = attackerKey === 'player' ? this.player : this.opponent;
    const defender = defenderKey === 'player' ? this.player : this.opponent;"""
    new_react = """    const attacker = this[attackerKey];
    const defender = this[defenderKey];"""
    js = js.replace(old_react, new_react)

    # 7. update fallbackToBotRaid / fallbackToBot2v2 call site support
    # Wait, in multiplayer-manager.js, we do:
    # this.engine.multiplayerMode = 'raid';
    # this.engine.startMatch...
    # So we should ensure 'multiplayerMode' exists.

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(js)
    print("Refactored game-engine.js logic")

if __name__ == '__main__':
    refactor_game_engine()
