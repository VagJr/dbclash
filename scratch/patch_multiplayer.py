import os

def patch_multiplayer_manager():
    filepath = 'c:/dbtcg/js/multiplayer-manager.js'
    with open(filepath, 'r', encoding='utf-8') as f:
        js = f.read()

    # 1. Update fallbackToBotRaid
    # Old: this.engine.startMatch(pLeader, 'frieza', finalDeck, true);
    old_start_raid = "this.engine.startMatch(pLeader, 'frieza', finalDeck, true);"
    new_start_raid = """this.engine.multiplayerMode = 'raid';
    this.engine.startMatch(pLeader, 'frieza', finalDeck, true);"""
    
    js = js.replace(old_start_raid, new_start_raid)

    # 2. Add keys mapping so gameEngine can access them
    # Wait, multiplayer-manager sets:
    # this.engine.ally = { ... }
    # but ui-manager expects engine.p1, engine.p2, engine.p3, engine.p4.
    # So let's map them explicitly!
    old_setup_raid = """    this.engine.opponent = {
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

    // 3. Configure 4 Mini Player Avatars together at the bottom
    this.engine.ally = { name: 'Vegeta (P2)', leader: { ...LEADERS.vegeta }, hp: 400, maxHp: 400, shields: 8, ki: 4, isAwakened: false, hand: [], deck: getStarterDeckForLeader('vegeta') };
    this.engine.ally2 = { name: 'Piccolo (P3)', leader: { ...LEADERS.piccolo }, hp: 400, maxHp: 400, shields: 8, ki: 4, isAwakened: false, hand: [], deck: getStarterDeckForLeader('piccolo') };
    this.engine.ally3 = { name: 'Trunks (P4)', leader: { ...LEADERS.trunks }, hp: 400, maxHp: 400, shields: 8, ki: 4, isAwakened: false, hand: [], deck: getStarterDeckForLeader('trunks') };
    this.engine.subOpponent = null; // Single massive Raid Boss on top!

    // 4. Turn Rotation: Player 1 -> Ally 1 -> Ally 2 -> Ally 3 -> Raid Boss Turn
    this.engine.turnOrder = ['player', 'ally', 'ally2', 'ally3', 'opponent'];"""

    new_setup_raid = """    this.engine.opponent = {
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

    // 3. Configure 4 Mini Player Avatars together at the bottom
    this.engine.ally = { name: 'Vegeta (P2)', leader: { ...LEADERS.vegeta }, hp: 400, maxHp: 400, shields: 8, ki: 4, isAwakened: false, hand: [], deck: getStarterDeckForLeader('vegeta') };
    this.engine.ally2 = { name: 'Piccolo (P3)', leader: { ...LEADERS.piccolo }, hp: 400, maxHp: 400, shields: 8, ki: 4, isAwakened: false, hand: [], deck: getStarterDeckForLeader('piccolo') };
    this.engine.ally3 = { name: 'Trunks (P4)', leader: { ...LEADERS.trunks }, hp: 400, maxHp: 400, shields: 8, ki: 4, isAwakened: false, hand: [], deck: getStarterDeckForLeader('trunks') };
    this.engine.subOpponent = null; // Single massive Raid Boss on top!
    
    // Map to p1, p2, p3, p4 so UI manager can easily iterate
    this.engine.p1 = this.engine.player;
    this.engine.p2 = this.engine.opponent; // The Boss
    this.engine.p3 = this.engine.ally;
    this.engine.p4 = this.engine.ally2;
    // Ally 3 won't fit on a 4-hud setup, but they will be part of the turn order. We only render 4 UI boxes right now, let's keep it simple.

    // 4. Turn Rotation: Player 1 -> Ally 1 -> Ally 2 -> Ally 3 -> Raid Boss Turn
    this.engine.turnOrder = ['player', 'ally', 'ally2', 'ally3', 'opponent'];"""
    
    js = js.replace(old_setup_raid, new_setup_raid)
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(js)
    print("Patched multiplayer-manager.js logic")

if __name__ == '__main__':
    patch_multiplayer_manager()
