import os
import re

def update_ui_manager():
    filepath = 'c:/dbtcg/js/ui-manager.js'
    with open(filepath, 'r', encoding='utf-8') as f:
        ui = f.read()

    # 1. Update menu card button listeners (lines 859-873)
    old_menu_listeners = """    document.getElementById('menu-btn-ranked-1v1')?.addEventListener('click', () => {
      soundEngine.playClick();
      this.multiplayer.startRanked1v1Matchmaking(this.selectedLeader);
    });

    document.getElementById('menu-btn-ranked-2v2')?.addEventListener('click', () => {
      soundEngine.playClick();
      alert('⚔️ MODO RANQUEADO 2v2 EM BREVE! Duplas online no Torneio do Poder.');
    });

    document.getElementById('menu-btn-coop-raid')?.addEventListener('click', () => {
      soundEngine.playClick();
      this.multiplayer.startCoOpRaid('cell_max', this.selectedLeader);
      sceneManager.switchScene(GAME_SCENES.ARENA);
    });"""

    new_menu_listeners = """    document.getElementById('menu-btn-ranked-1v1')?.addEventListener('click', () => {
      soundEngine.playClick();
      this.multiplayer.startMatchmaking('1v1', this.selectedLeader);
    });

    document.getElementById('menu-btn-ranked-2v2')?.addEventListener('click', () => {
      soundEngine.playClick();
      this.multiplayer.startMatchmaking('2v2', this.selectedLeader);
    });

    document.getElementById('menu-btn-coop-raid')?.addEventListener('click', () => {
      soundEngine.playClick();
      this.multiplayer.startMatchmaking('raid', this.selectedLeader);
    });"""

    if old_menu_listeners in ui:
        ui = ui.replace(old_menu_listeners, new_menu_listeners)

    # 2. Update renderArena in ui-manager.js
    new_render_arena = """  renderArena(engine) {
    if (!engine) return;

    const arenaEl = document.getElementById('scene-arena');
    if (arenaEl) {
      arenaEl.classList.remove('arena-mode-1v1', 'arena-mode-2v2', 'arena-mode-raid');
      arenaEl.classList.add(`arena-mode-${engine.multiplayerMode || '1v1'}`);
    }

    const mode = engine.multiplayerMode || '1v1';
    const p3Box = document.getElementById('p3-leader-box');
    const p4Box = document.getElementById('p4-leader-box');
    const p5Box = document.getElementById('p5-leader-box');
    const p6Box = document.getElementById('p6-leader-box');

    if (mode === '2v2') {
      if (p3Box) p3Box.style.display = 'flex';
      if (p4Box) p4Box.style.display = 'flex';
      if (p5Box) p5Box.style.display = 'none';
      if (p6Box) p6Box.style.display = 'none';
      
      this.renderFighterHUD('p1', engine.p1 || engine.player);
      this.renderFighterHUD('p2', engine.p2 || engine.opponent);
      this.renderFighterHUD('p3', engine.p3);
      this.renderFighterHUD('p4', engine.p4);
    } else if (mode === 'raid') {
      if (p3Box) p3Box.style.display = 'flex';
      if (p4Box) p4Box.style.display = 'none';
      if (p5Box) p5Box.style.display = 'flex';
      if (p6Box) p6Box.style.display = 'flex';

      this.renderFighterHUD('p2', engine.p2 || engine.opponent);
      this.renderFighterHUD('p1', engine.p1 || engine.player);
      this.renderFighterHUD('p3', engine.p3);
      this.renderFighterHUD('p5', engine.p5);
      this.renderFighterHUD('p6', engine.p6);
    } else {
      if (p3Box) p3Box.style.display = 'none';
      if (p4Box) p4Box.style.display = 'none';
      if (p5Box) p5Box.style.display = 'none';
      if (p6Box) p6Box.style.display = 'none';

      this.renderFighterHUD('p1', engine.player);
      this.renderFighterHUD('p2', engine.opponent);
    }

    this.renderHand(engine.player ? engine.player.hand : []);
    this.updateBattlefieldState(engine);
  }"""

    pattern_ra = r'  renderArena\(engine\) \{[\s\S]*?\n  \}'
    ui = re.sub(pattern_ra, new_render_arena, ui, count=1)

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(ui)
    print("Updated ui-manager.js with unlocked mode buttons and multi-HUD rendering!")

if __name__ == '__main__':
    update_ui_manager()
