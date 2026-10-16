import os
import re

def update_index_html():
    filepath = 'c:/dbtcg/index.html'
    with open(filepath, 'r', encoding='utf-8') as f:
        html = f.read()

    top_huds_html = """      <!-- Top HUDs Container (Opponents) -->
      <div id="top-hud-container" class="scouter-hud-container top-hud-container">
        <!-- Opponent 1 HUD (Dokkan Crimson Scouter HUD) -->
        <div id="p2-leader-box" class="fighter-hud hud-opponent dokkan-scouter-hud">
          <div class="scouter-scanlines"></div>
          <div class="scouter-portrait-wrapper">
            <div id="p2-portrait" class="hud-portrait">
              <img src="assets/leaders/vegeta.png" alt="Vegeta" class="leader-portrait-img" style="width:100%; height:100%; object-fit:cover; object-position:top center; border-radius:50%;">
            </div>
            <div class="scouter-lockon-ring"></div>
          </div>
          <div class="hud-info">
            <div class="hud-top-row">
              <div id="p2-name" class="hud-name">Vegeta <span class="awaken-badge">AWAKENED</span></div>
              <span id="p2-hp-text" class="hp-text">400/400 HP</span>
            </div>
            <div class="hp-bar-container">
              <div class="hp-bar-track"><div id="p2-hp-fill" class="hp-bar-fill" style="width:100%"></div></div>
            </div>
            <div class="hud-bottom-row">
              <div id="p2-shields" class="shields-row"></div>
              <div class="ki-row">
                <div id="p2-ki-slots" class="ki-pips"></div>
                <span id="p2-ki-text" class="ki-label">4/10 KI</span>
              </div>
            </div>
          </div>
          <div class="guard-warn">OPEN GUARD</div>
          <div class="scouter-ear-cap"><div class="sec-slot"></div></div>
        </div>

        <!-- Opponent 2 HUD (2v2 Mode) -->
        <div id="p4-leader-box" class="fighter-hud hud-opponent dokkan-scouter-hud multi-hud-slot" style="display:none;">
          <div class="scouter-scanlines"></div>
          <div class="scouter-portrait-wrapper">
            <div id="p4-portrait" class="hud-portrait">
              <img src="assets/leaders/frieza.png" alt="Frieza" class="leader-portrait-img" style="width:100%; height:100%; object-fit:cover; object-position:top center; border-radius:50%;">
            </div>
            <div class="scouter-lockon-ring"></div>
          </div>
          <div class="hud-info">
            <div class="hud-top-row">
              <div id="p4-name" class="hud-name">Frieza <span class="awaken-badge">AWAKENED</span></div>
              <span id="p4-hp-text" class="hp-text">400/400 HP</span>
            </div>
            <div class="hp-bar-container">
              <div class="hp-bar-track"><div id="p4-hp-fill" class="hp-bar-fill" style="width:100%"></div></div>
            </div>
            <div class="hud-bottom-row">
              <div id="p4-shields" class="shields-row"></div>
              <div class="ki-row">
                <div id="p4-ki-slots" class="ki-pips"></div>
                <span id="p4-ki-text" class="ki-label">4/10 KI</span>
              </div>
            </div>
          </div>
          <div class="guard-warn">OPEN GUARD</div>
          <div class="scouter-ear-cap"><div class="sec-slot"></div></div>
        </div>
      </div>"""

    pattern_top = r'<!-- Opponent HUD \(Dokkan Crimson Scouter HUD\) -->[\s\S]*?</div>\s*</div>\s*</div>\s*</div>'
    # Replace single p2-leader-box in arena-zone-top with top_huds_html
    old_p2 = """      <!-- Opponent HUD (Dokkan Crimson Scouter HUD) -->
      <div id="p2-leader-box" class="fighter-hud hud-opponent dokkan-scouter-hud">
        <div class="scouter-scanlines"></div>
        <div class="scouter-portrait-wrapper">
          <div id="p2-portrait" class="hud-portrait">
            <img src="assets/leaders/vegeta.png" alt="Vegeta" class="leader-portrait-img" style="width:100%; height:100%; object-fit:cover; object-position:top center; border-radius:50%;">
          </div>
          <div class="scouter-lockon-ring"></div>
        </div>
        <div class="hud-info">
          <div class="hud-top-row">
            <div id="p2-name" class="hud-name">Vegeta <span class="awaken-badge">AWAKENED</span></div>
            <span id="p2-hp-text" class="hp-text">400/400 HP</span>
          </div>
          <div class="hp-bar-container">
            <div class="hp-bar-track"><div id="p2-hp-fill" class="hp-bar-fill" style="width:100%"></div></div>
          </div>
          <div class="hud-bottom-row">
            <div id="p2-shields" class="shields-row"></div>
            <div class="ki-row">
              <div id="p2-ki-slots" class="ki-pips"></div>
              <span id="p2-ki-text" class="ki-label">4/10 KI</span>
            </div>
          </div>
        </div>
        <div class="guard-warn">OPEN GUARD</div>
        <div class="scouter-ear-cap">
          <div class="sec-slot"></div>
        </div>
      </div>"""

    if old_p2 in html:
        html = html.replace(old_p2, top_huds_html)

    bot_huds_html = """      <!-- Bottom HUDs Container (Player & Team Members) -->
      <div id="bot-hud-container" class="scouter-hud-container bot-hud-container">
        <!-- Player 1 HUD (You) -->
        <div id="p1-leader-box" class="fighter-hud hud-player dokkan-scouter-hud">
          <div class="scouter-scanlines"></div>
          <div class="scouter-portrait-wrapper">
            <div id="p1-portrait" class="hud-portrait">
              <img src="assets/leaders/goku.png" alt="Son Goku" class="leader-portrait-img" style="width:100%; height:100%; object-fit:cover; object-position:top center; border-radius:50%;">
            </div>
            <div class="scouter-lockon-ring"></div>
          </div>
          <div class="hud-info">
            <div class="hud-top-row">
              <div id="p1-name" class="hud-name">Son Goku <span class="awaken-badge">AWAKENED</span></div>
              <span id="p1-hp-text" class="hp-text">400/400 HP</span>
            </div>
            <div class="hp-bar-container">
              <div class="hp-bar-track"><div id="p1-hp-fill" class="hp-bar-fill" style="width:100%"></div></div>
            </div>
            <div class="hud-bottom-row">
              <div id="p1-shields" class="shields-row"></div>
              <div class="ki-row">
                <div id="p1-ki-slots" class="ki-pips"></div>
                <span id="p1-ki-text" class="ki-label">4/10 KI</span>
              </div>
            </div>
          </div>
          <div class="guard-warn">OPEN GUARD</div>
          <div class="scouter-ear-cap"><div class="sec-slot"></div></div>
        </div>

        <!-- Partner Ally (2v2 Partner / Raid Warrior 2) -->
        <div id="p3-leader-box" class="fighter-hud hud-player dokkan-scouter-hud multi-hud-slot" style="display:none;">
          <div class="scouter-scanlines"></div>
          <div class="scouter-portrait-wrapper">
            <div id="p3-portrait" class="hud-portrait">
              <img src="assets/leaders/gohan.png" alt="Gohan" class="leader-portrait-img" style="width:100%; height:100%; object-fit:cover; object-position:top center; border-radius:50%;">
            </div>
            <div class="scouter-lockon-ring"></div>
          </div>
          <div class="hud-info">
            <div class="hud-top-row">
              <div id="p3-name" class="hud-name">Gohan <span class="awaken-badge">AWAKENED</span></div>
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

        <!-- Raid Warrior 3 -->
        <div id="p5-leader-box" class="fighter-hud hud-player dokkan-scouter-hud multi-hud-slot" style="display:none;">
          <div class="scouter-scanlines"></div>
          <div class="scouter-portrait-wrapper">
            <div id="p5-portrait" class="hud-portrait">
              <img src="assets/leaders/vegeta.png" alt="Vegeta" class="leader-portrait-img" style="width:100%; height:100%; object-fit:cover; object-position:top center; border-radius:50%;">
            </div>
            <div class="scouter-lockon-ring"></div>
          </div>
          <div class="hud-info">
            <div class="hud-top-row">
              <div id="p5-name" class="hud-name">Vegeta <span class="awaken-badge">AWAKENED</span></div>
              <span id="p5-hp-text" class="hp-text">400/400 HP</span>
            </div>
            <div class="hp-bar-container">
              <div class="hp-bar-track"><div id="p5-hp-fill" class="hp-bar-fill" style="width:100%"></div></div>
            </div>
            <div class="hud-bottom-row">
              <div id="p5-shields" class="shields-row"></div>
              <div class="ki-row">
                <div id="p5-ki-slots" class="ki-pips"></div>
                <span id="p5-ki-text" class="ki-label">4/10 KI</span>
              </div>
            </div>
          </div>
          <div class="guard-warn">OPEN GUARD</div>
          <div class="scouter-ear-cap"><div class="sec-slot"></div></div>
        </div>

        <!-- Raid Warrior 4 -->
        <div id="p6-leader-box" class="fighter-hud hud-player dokkan-scouter-hud multi-hud-slot" style="display:none;">
          <div class="scouter-scanlines"></div>
          <div class="scouter-portrait-wrapper">
            <div id="p6-portrait" class="hud-portrait">
              <img src="assets/leaders/trunks.png" alt="Trunks" class="leader-portrait-img" style="width:100%; height:100%; object-fit:cover; object-position:top center; border-radius:50%;">
            </div>
            <div class="scouter-lockon-ring"></div>
          </div>
          <div class="hud-info">
            <div class="hud-top-row">
              <div id="p6-name" class="hud-name">Trunks <span class="awaken-badge">AWAKENED</span></div>
              <span id="p6-hp-text" class="hp-text">400/400 HP</span>
            </div>
            <div class="hp-bar-container">
              <div class="hp-bar-track"><div id="p6-hp-fill" class="hp-bar-fill" style="width:100%"></div></div>
            </div>
            <div class="hud-bottom-row">
              <div id="p6-shields" class="shields-row"></div>
              <div class="ki-row">
                <div id="p6-ki-slots" class="ki-pips"></div>
                <span id="p6-ki-text" class="ki-label">4/10 KI</span>
              </div>
            </div>
          </div>
          <div class="guard-warn">OPEN GUARD</div>
          <div class="scouter-ear-cap"><div class="sec-slot"></div></div>
        </div>
      </div>"""

    old_p1 = """      <!-- Player HUD (Dokkan Green Scouter HUD) -->
      <div id="p1-leader-box" class="fighter-hud hud-player dokkan-scouter-hud">
        <div class="scouter-scanlines"></div>
        <div class="scouter-portrait-wrapper">
          <div id="p1-portrait" class="hud-portrait">
            <img src="assets/leaders/goku.png" alt="Son Goku" class="leader-portrait-img" style="width:100%; height:100%; object-fit:cover; object-position:top center; border-radius:50%;">
          </div>
          <div class="scouter-lockon-ring"></div>
        </div>
        <div class="hud-info">
          <div class="hud-top-row">
            <div id="p1-name" class="hud-name">Son Goku <span class="awaken-badge">AWAKENED</span></div>
            <span id="p1-hp-text" class="hp-text">400/400 HP</span>
          </div>
          <div class="hp-bar-container">
            <div class="hp-bar-track"><div id="p1-hp-fill" class="hp-bar-fill" style="width:100%"></div></div>
          </div>
          <div class="hud-bottom-row">
            <div id="p1-shields" class="shields-row"></div>
            <div class="ki-row">
              <div id="p1-ki-slots" class="ki-pips"></div>
              <span id="p1-ki-text" class="ki-label">4/10 KI</span>
            </div>
          </div>
        </div>
        <div class="guard-warn">OPEN GUARD</div>
        <div class="scouter-ear-cap">
          <div class="sec-slot"></div>
        </div>
      </div>"""

    if old_p1 in html:
        html = html.replace(old_p1, bot_huds_html)

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(html)
    print("Updated index.html with top and bottom HUD containers and p3, p4, p5, p6 slots!")

if __name__ == '__main__':
    update_index_html()
