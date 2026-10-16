import os

def update_arena_css():
    filepath = 'c:/dbtcg/styles/arena.css'
    with open(filepath, 'r', encoding='utf-8') as f:
        css = f.read()

    mode_css = """

/* ==========================================================================
   EXCLUSIVE ARENA LAYOUT MODES: 1v1, 2v2, AND RAID CO-OP
   ========================================================================== */

/* --- HUD Container Base Flex --- */
.scouter-hud-container {
  display: flex;
  flex-direction: row;
  justify-content: center;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 0 10px;
  box-sizing: border-box;
  z-index: 10;
  transition: all 0.3s ease;
}

.scouter-hud-container .fighter-hud {
  transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

/* --- MODE 1v1 (Classic Single Duel) --- */
.arena-mode-1v1 .scouter-hud-container .fighter-hud {
  max-width: 580px;
  width: 100%;
}
.arena-mode-1v1 #p3-leader-box,
.arena-mode-1v1 #p4-leader-box,
.arena-mode-1v1 #p5-leader-box,
.arena-mode-1v1 #p6-leader-box {
  display: none !important;
}

/* --- MODE 2v2 (Dueto Online: 2 Top, 2 Bottom) --- */
.arena-mode-2v2 .scouter-hud-container {
  gap: 10px;
}
.arena-mode-2v2 .scouter-hud-container .fighter-hud {
  flex: 1;
  max-width: 340px;
  padding: 6px 12px;
}
.arena-mode-2v2 .fighter-hud .hud-portrait {
  width: 44px;
  height: 44px;
}
.arena-mode-2v2 .fighter-hud .hud-name {
  font-size: 0.85rem;
}
.arena-mode-2v2 .fighter-hud .hp-text {
  font-size: 0.75rem;
}
.arena-mode-2v2 #p5-leader-box,
.arena-mode-2v2 #p6-leader-box {
  display: none !important;
}

/* --- MODE RAID CO-OP (1 Boss Top, 4 Warriors Bottom) --- */
.arena-mode-raid .top-hud-container .fighter-hud {
  max-width: 620px;
  width: 100%;
  border-color: #ff0000 !important;
  box-shadow: 0 0 30px rgba(255, 0, 0, 0.8), inset 0 0 15px rgba(255, 0, 0, 0.4);
}
.arena-mode-raid #p4-leader-box {
  display: none !important;
}

.arena-mode-raid .bot-hud-container {
  gap: 6px;
  justify-content: space-between;
}
.arena-mode-raid .bot-hud-container .fighter-hud {
  flex: 1;
  min-width: 0; /* allows shrinking */
  padding: 4px 8px;
  border-radius: 12px;
}
.arena-mode-raid .bot-hud-container .fighter-hud .hud-portrait {
  width: 36px;
  height: 36px;
}
.arena-mode-raid .bot-hud-container .fighter-hud .hud-name {
  font-size: 0.75rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.arena-mode-raid .bot-hud-container .fighter-hud .hp-text {
  font-size: 0.65rem;
}
.arena-mode-raid .bot-hud-container .scouter-ear-cap {
  display: none; /* remove ear cap to save horizontal width */
}

/* --- MOBILE RESPONSIVENESS FOR 2v2 & RAID --- */
@media (max-width: 768px) {
  .arena-mode-2v2 .scouter-hud-container {
    gap: 4px;
  }
  .arena-mode-2v2 .fighter-hud {
    padding: 4px 6px !important;
  }
  .arena-mode-2v2 .hud-portrait {
    width: 32px !important;
    height: 32px !important;
  }
  .arena-mode-2v2 .hud-name {
    font-size: 0.7rem !important;
  }

  .arena-mode-raid .bot-hud-container {
    gap: 3px;
  }
  .arena-mode-raid .bot-hud-container .fighter-hud {
    padding: 3px 4px !important;
    gap: 4px;
  }
  .arena-mode-raid .bot-hud-container .hud-portrait {
    width: 28px !important;
    height: 28px !important;
  }
  .arena-mode-raid .bot-hud-container .hud-name {
    font-size: 0.65rem !important;
  }
  .arena-mode-raid .bot-hud-container .hp-text {
    font-size: 0.6rem !important;
  }
  .arena-mode-raid .bot-hud-container .ki-label {
    display: none; /* hide label text on tiny screens */
  }
}
"""

    with open(filepath, 'a', encoding='utf-8') as f:
        f.write(mode_css)
    print("Successfully appended Arena Layout Modes CSS to arena.css!")

if __name__ == '__main__':
    update_arena_css()
