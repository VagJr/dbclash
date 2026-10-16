import os
import re

def patch_ui_manager():
    filepath = 'c:/dbtcg/js/ui-manager.js'
    with open(filepath, 'r', encoding='utf-8') as f:
        js = f.read()

    # 1. Update initDOM
    # I need to add p3 and p4 bindings
    old_init = """    this.p2LeaderBox = document.getElementById('p2-leader-box');

    // Arena — Actions"""

    new_init = """    this.p2LeaderBox = document.getElementById('p2-leader-box');
    
    // Arena — Ally 1 (p3)
    this.p3Portrait = document.getElementById('p3-portrait');
    this.p3Name = document.getElementById('p3-name');
    this.p3HpFill = document.getElementById('p3-hp-fill');
    this.p3HpText = document.getElementById('p3-hp-text');
    this.p3Shields = document.getElementById('p3-shields');
    this.p3KiSlots = document.getElementById('p3-ki-slots');
    this.p3KiText = document.getElementById('p3-ki-text');
    this.p3LeaderBox = document.getElementById('p3-leader-box');
    
    // Arena — Ally 2 / Boss (p4)
    this.p4Portrait = document.getElementById('p4-portrait');
    this.p4Name = document.getElementById('p4-name');
    this.p4HpFill = document.getElementById('p4-hp-fill');
    this.p4HpText = document.getElementById('p4-hp-text');
    this.p4Shields = document.getElementById('p4-shields');
    this.p4KiSlots = document.getElementById('p4-ki-slots');
    this.p4KiText = document.getElementById('p4-ki-text');
    this.p4LeaderBox = document.getElementById('p4-leader-box');

    // Arena — Actions"""

    js = js.replace(old_init, new_init)

    # 2. Update renderArena
    # Old logic:
    #     this.renderFighterHUD('p1', p);
    #     this.renderFighterHUD('p2', o);
    old_render = """    this.renderFighterHUD('p1', p);
    this.renderFighterHUD('p2', o);"""

    new_render = """    this.renderFighterHUD('p1', engine.p1);
    this.renderFighterHUD('p2', engine.p2);
    this.renderFighterHUD('p3', engine.p3);
    this.renderFighterHUD('p4', engine.p4);"""
    
    # We might need to ensure 'p' and 'o' are mapped to engine.p1 and engine.p2 in renderArena
    # So wait! If I just replace p1 with engine.p1, what if engine has player and opponent instead of p1 and p2 right now?
    # I should change renderArena to look at engine.p1 or engine.player
    new_render_flexible = """    const p1 = engine.p1 || engine.player;
    const p2 = engine.p2 || engine.opponent;
    this.renderFighterHUD('p1', p1);
    this.renderFighterHUD('p2', p2);
    this.renderFighterHUD('p3', engine.p3 || engine.ally);
    this.renderFighterHUD('p4', engine.p4 || engine.subOpponent || engine.ally2);"""
    
    js = js.replace(old_render, new_render_flexible)

    # 3. Update playCard in dropZone
    # `this.gameEngine.playCard('player', cardIndex);` -> wait, we need it to be dynamic based on who is local.
    # Actually, the local player is always 'p1' or 'player' in gameEngine. So this is fine.
    # Let's verify that hand rendering works for 'p1'.
    old_hand = """this.renderPlayerHand(p.hand, p.ki, engine.state, engine.initiative, engine.pendingAttack, p.isOpenGuard);"""
    new_hand = """const activeP = engine.p1 || engine.player;
    if (activeP) this.renderPlayerHand(activeP.hand, activeP.ki, engine.state, engine.initiative, engine.pendingAttack, activeP.isOpenGuard);"""
    js = js.replace(old_hand, new_hand)

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(js)
    print("Patched ui-manager.js")

if __name__ == '__main__':
    patch_ui_manager()
