import os

def append_hud_css():
    filepath = 'c:/dbtcg/styles/arena.css'
    with open(filepath, 'r', encoding='utf-8') as f:
        css = f.read()

    hud_layout_css = """

/* ==========================================================================
   DESKTOP & RESPONSIVE MULTI-HUD FLEX & GRID CONTAINERS
   ========================================================================== */
.scouter-hud-container {
  display: flex;
  flex-direction: row;
  justify-content: center;
  align-items: center;
  gap: 12px;
  width: 100%;
  box-sizing: border-box;
}

/* 2v2 Mode: 2 Top HUDs side-by-side, 2 Bottom HUDs side-by-side */
.arena-mode-2v2 .scouter-hud-container .fighter-hud {
  flex: 1;
  max-width: 420px;
}

/* Raid Co-Op Mode: 1 Giant Boss HUD centered on top, 4 Warriors on bottom */
.arena-mode-raid .top-hud-container {
  justify-content: center;
}

.arena-mode-raid .top-hud-container .fighter-hud {
  max-width: 600px;
  width: 100%;
}

.arena-mode-raid .bot-hud-container {
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
}

.arena-mode-raid .bot-hud-container .fighter-hud {
  flex: 1;
  max-width: 280px;
}

/* 1v1 Mode: Standard Centered HUD */
.arena-mode-1v1 .scouter-hud-container .fighter-hud {
  max-width: 520px;
  width: 100%;
}
"""

    if '.scouter-hud-container {' not in css:
        css += hud_layout_css

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(css)
    print("Appended HUD container layout CSS to arena.css!")

if __name__ == '__main__':
    append_hud_css()
