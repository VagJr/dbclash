import os
import re

def update_index_html():
    filepath = 'c:/dbtcg/index.html'
    with open(filepath, 'r', encoding='utf-8') as f:
        html = f.read()
    
    p3_html = """
        <!-- Ally 1 (For 2v2 / Raid Co-Op) HUD (Dokkan Green Scouter HUD) -->
        <div id="p3-leader-box" class="fighter-hud hud-player dokkan-scouter-hud multi-hud" style="display:none;">
          <div class="scouter-scanlines"></div>
          <div class="scouter-portrait-wrapper">
            <div id="p3-portrait" class="hud-portrait">
              <img src="assets/leaders/piccolo.png" alt="Piccolo" class="leader-portrait-img" style="width:100%; height:100%; object-fit:cover; object-position:top center; border-radius:50%;">
            </div>
            <div class="scouter-lockon-ring"></div>
          </div>
          <div class="hud-info">
            <div class="hud-top-row">
              <div id="p3-name" class="hud-name">Piccolo <span class="awaken-badge">AWAKENED</span></div>
              <span id="p3-hp-text" class="hp-text">400/400 HP</span>
            </div>
            <div class="hp-bar-container">
              <div class="hp-bar-track"><div id="p3-hp-fill" class="hp-bar-fill" style="width:100%"></div></div>
            </div>
            <div class="hud-bottom-row">
              <div id="p3-shields" class="shields-row"></div>
              <div class="ki-row">
                <div id="p3-ki-slots" class="ki-pips"></div>
                <span id="p3-ki-text" class="ki-label">4/10 KI</span>
              </div>
            </div>
          </div>
          <div class="guard-warn">OPEN GUARD</div>
          <div class="scouter-ear-cap"><div class="sec-slot"></div></div>
        </div>
"""

    if 'id="p3-leader-box"' not in html:
        pattern = r'(<div id="p1-leader-box"[\s\S]*?<div class="scouter-ear-cap"><div class="sec-slot"></div></div>\s*</div>)'
        html = re.sub(pattern, r'\1\n' + p3_html, html, count=1)
        
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(html)
    print("Done updating index.html")

if __name__ == '__main__':
    update_index_html()
