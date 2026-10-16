import os

def patch_arena_css():
    filepath = 'c:/dbtcg/styles/arena.css'
    
    css_additions = """

/* ==========================================================================
   TARGET SELECTION LOCK-ON & MOBILE RAID 2x2 GRID LAYOUT
   ========================================================================== */

/* Target Lock-On Indicator */
.fighter-hud.selected-target-lockon {
  border-color: #ff0000 !important;
  box-shadow: 0 0 25px #ff0000, inset 0 0 15px rgba(255, 0, 0, 0.5) !important;
  transform: scale(1.03);
}

.fighter-hud.selected-target-lockon .scouter-lockon-ring {
  border-color: #ff0000 !important;
  animation: lockonSpin 1.5s linear infinite;
}

@keyframes lockonSpin {
  0% { transform: translate(-50%, -50%) rotate(0deg) scale(1); }
  50% { transform: translate(-50%, -50%) rotate(180deg) scale(1.2); }
  100% { transform: translate(-50%, -50%) rotate(360deg) scale(1); }
}

/* --- MOBILE SPECIFIC 2x2 GRID FOR RAID TEAM --- */
@media (max-width: 768px) {
  /* Raid Mode: 4 Team Members arranged in 2x2 Grid at bottom on Mobile */
  .arena-mode-raid .bot-hud-container {
    display: grid !important;
    grid-template-columns: 1fr 1fr !important;
    grid-template-rows: auto auto !important;
    gap: 6px 8px !important;
    width: 100% !important;
    box-sizing: border-box !important;
    padding: 0 4px !important;
  }

  .arena-mode-raid .bot-hud-container .fighter-hud {
    width: 100% !important;
    max-width: 100% !important;
    padding: 4px 6px !important;
  }

  .arena-mode-raid .top-hud-container .fighter-hud {
    max-width: 100% !important;
  }

  /* 2v2 Mode Mobile Spacing */
  .arena-mode-2v2 .scouter-hud-container {
    gap: 6px !important;
    justify-content: space-between !important;
  }
  .arena-mode-2v2 .scouter-hud-container .fighter-hud {
    max-width: 48% !important;
    padding: 5px 8px !important;
  }

  /* Reduce center battlefield crowding on Mobile */
  .arena-zone-mid {
    margin: 4px 0 !important;
  }
  .drop-zone {
    min-height: 90px !important;
    padding: 8px !important;
  }
}
"""

    with open(filepath, 'a', encoding='utf-8') as f:
        f.write(css_additions)
    print("Appended Target Lock-On and Mobile Raid 2x2 Grid CSS to arena.css!")

if __name__ == '__main__':
    patch_arena_css()
