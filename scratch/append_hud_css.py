import os

def append_css():
    filepath = 'c:/dbtcg/styles/arena.css'
    
    css_rules = """
/* ==========================================================================
   Multi-Player HUD Container Layout (Raid & 2v2)
   ========================================================================== */
.scouter-hud-container {
  display: flex;
  flex-direction: row;
  justify-content: center;
  align-items: center;
  gap: 15px;
  width: 100%;
  pointer-events: none;
}

.scouter-hud-container .fighter-hud {
  flex: 1;
  max-width: 400px;
  pointer-events: auto;
}

@media (max-width: 768px) {
  .scouter-hud-container {
    gap: 5px;
  }
  .scouter-hud-container .fighter-hud {
    padding: 4px 6px;
  }
  .fighter-hud .hud-portrait { width: 30px; height: 30px; }
  .fighter-hud .hud-name { font-size: 0.75rem; }
  .fighter-hud .hp-text { font-size: 0.65rem; }
}
"""
    with open(filepath, 'a', encoding='utf-8') as f:
        f.write(css_rules)
    print("Appended HUD container styles to arena.css")

if __name__ == '__main__':
    append_css()
