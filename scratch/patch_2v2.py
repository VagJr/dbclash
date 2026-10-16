import os

def patch_fallback_2v2():
    filepath = 'c:/dbtcg/js/multiplayer-manager.js'
    with open(filepath, 'r', encoding='utf-8') as f:
        js = f.read()

    old_2v2 = """    this.engine.startMatch(pLeader, 'vegeta', finalDeck, true);
    
    // Initialize 4-Player 2v2 Fighters
    this.engine.ally = { name: 'Gohan (Aliado)', leader: { ...LEADERS.gohan }, hp: 400, maxHp: 400, shields: 8, ki: 4, isAwakened: false, hand: [], deck: getStarterDeckForLeader('gohan') };
    this.engine.subOpponent = { name: 'Frieza (Dupla Inimiga)', leader: { ...LEADERS.frieza }, hp: 400, maxHp: 400, shields: 8, ki: 5, isAwakened: false, hand: [], deck: getStarterDeckForLeader('frieza') };
    this.engine.turnOrder = ['player', 'opponent', 'ally', 'subOpponent'];"""

    new_2v2 = """    this.engine.multiplayerMode = '2v2';
    this.engine.startMatch(pLeader, 'vegeta', finalDeck, true);
    
    // Initialize 4-Player 2v2 Fighters
    this.engine.ally = { name: 'Gohan (Aliado)', leader: { ...LEADERS.gohan }, hp: 400, maxHp: 400, shields: 8, ki: 4, isAwakened: false, hand: [], deck: getStarterDeckForLeader('gohan') };
    this.engine.subOpponent = { name: 'Frieza (Dupla Inimiga)', leader: { ...LEADERS.frieza }, hp: 400, maxHp: 400, shields: 8, ki: 5, isAwakened: false, hand: [], deck: getStarterDeckForLeader('frieza') };
    
    this.engine.p1 = this.engine.player;
    this.engine.p2 = this.engine.opponent;
    this.engine.p3 = this.engine.ally;
    this.engine.p4 = this.engine.subOpponent;

    this.engine.turnOrder = ['player', 'opponent', 'ally', 'subOpponent'];"""
    
    js = js.replace(old_2v2, new_2v2)
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(js)
    print("Patched 2v2 in multiplayer-manager.js")

if __name__ == '__main__':
    patch_fallback_2v2()
