import os

def update_ui_manager():
    filepath = 'c:/dbtcg/js/ui-manager.js'
    with open(filepath, 'r', encoding='utf-8') as f:
        js = f.read()

    # 1. Update Menu button listeners
    old_menu_listeners = """    document.getElementById('menu-btn-ranked-2v2')?.addEventListener('click', () => {
      soundEngine.playClick();
      alert('⚔️ MODO RANQUEADO 2v2 EM BREVE! Duplas online no Torneio do Poder.');
    });

    document.getElementById('menu-btn-coop-raid')?.addEventListener('click', () => {
      soundEngine.playClick();
      this.multiplayer.startCoOpRaid('cell_max', this.selectedLeader);
      sceneManager.switchScene(GAME_SCENES.ARENA);
    });"""

    new_menu_listeners = """    document.getElementById('menu-btn-ranked-2v2')?.addEventListener('click', () => {
      soundEngine.playClick();
      this.multiplayer.startRanked2v2(this.selectedLeader);
    });

    document.getElementById('menu-btn-coop-raid')?.addEventListener('click', () => {
      soundEngine.playClick();
      this.multiplayer.startCoOpRaid('cell_max', this.selectedLeader);
    });"""

    js = js.replace(old_menu_listeners, new_menu_listeners)

    # 2. Update renderArena
    old_hud_render = """    // Player HUD
    this.renderFighterHUD('p1', p);
    // Opponent HUD
    this.renderFighterHUD('p2', opp);"""

    new_hud_render = """    // Arena Mode & Responsive Layout Setup
    const mode = engine.multiplayerMode || '1v1';
    const sceneArena = document.getElementById('scene-arena');
    if (sceneArena) {
      sceneArena.classList.remove('arena-mode-1v1', 'arena-mode-2v2', 'arena-mode-raid');
      sceneArena.classList.add(`arena-mode-${mode}`);
    }

    if (mode === 'raid') {
      this.renderFighterHUD('p2', engine.p2 || opp);
      this.renderFighterHUD('p1', engine.p1 || p);
      this.renderFighterHUD('p3', engine.p3);
      this.renderFighterHUD('p5', engine.p5);
      this.renderFighterHUD('p6', engine.p6);
      this.renderFighterHUD('p4', null);
    } else if (mode === '2v2') {
      this.renderFighterHUD('p2', engine.p2 || opp);
      this.renderFighterHUD('p4', engine.p4);
      this.renderFighterHUD('p1', engine.p1 || p);
      this.renderFighterHUD('p3', engine.p3);
      this.renderFighterHUD('p5', null);
      this.renderFighterHUD('p6', null);
    } else {
      // 1v1 Mode
      this.renderFighterHUD('p1', engine.p1 || p);
      this.renderFighterHUD('p2', engine.p2 || opp);
      this.renderFighterHUD('p3', null);
      this.renderFighterHUD('p4', null);
      this.renderFighterHUD('p5', null);
      this.renderFighterHUD('p6', null);
    }"""

    js = js.replace(old_hud_render, new_hud_render)

    # 3. Update renderFighterHUD null check
    old_fighter_hud = """  renderFighterHUD(prefix, fighter) {
    const portrait = document.getElementById(`${prefix}-portrait`);"""

    new_fighter_hud = """  renderFighterHUD(prefix, fighter) {
    const leaderBox = document.getElementById(`${prefix}-leader-box`);
    if (!fighter || !fighter.leader) {
      if (leaderBox) leaderBox.style.display = 'none';
      return;
    }
    if (leaderBox) leaderBox.style.display = 'flex';

    const portrait = document.getElementById(`${prefix}-portrait`);"""

    js = js.replace(old_fighter_hud, new_fighter_hud)

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(js)
    print("Updated ui-manager.js successfully!")

if __name__ == '__main__':
    update_ui_manager()
