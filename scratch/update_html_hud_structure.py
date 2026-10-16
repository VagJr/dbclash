import os
import re

def update_html_huds():
    filepath = 'c:/dbtcg/index.html'
    with open(filepath, 'r', encoding='utf-8') as f:
        html = f.read()

    # Template for a fighter HUD box
    def create_hud_box(hud_id, hud_type, leader_img, leader_name, is_hidden=False):
        style = ' style="display:none;"' if is_hidden else ''
        return f"""
        <div id="{hud_id}-leader-box" class="fighter-hud {hud_type} dokkan-scouter-hud"{style}>
          <div class="scouter-scanlines"></div>
          <div class="scouter-portrait-wrapper">
            <div id="{hud_id}-portrait" class="hud-portrait">
              <img src="assets/leaders/{leader_img}.png" alt="{leader_name}" class="leader-portrait-img">
            </div>
            <div class="scouter-lockon-ring"></div>
          </div>
          <div class="hud-info">
            <div class="hud-top-row">
              <div id="{hud_id}-name" class="hud-name">{leader_name} <span class="awaken-badge">AWAKENED</span></div>
              <span id="{hud_id}-hp-text" class="hp-text">400/400 HP</span>
            </div>
            <div class="hp-bar-container">
              <div class="hp-bar-track"><div id="{hud_id}-hp-fill" class="hp-bar-fill" style="width:100%"></div></div>
            </div>
            <div class="hud-bottom-row">
              <div id="{hud_id}-shields" class="shields-row"></div>
              <div class="ki-row">
                <div id="{hud_id}-ki-slots" class="ki-pips"></div>
                <span id="{hud_id}-ki-text" class="ki-label">4/10 KI</span>
              </div>
            </div>
          </div>
          <div class="guard-warn">OPEN GUARD</div>
          <div class="scouter-ear-cap"><div class="sec-slot"></div></div>
        </div>"""

    top_hud_content = f"""
      <div id="top-hud-container" class="scouter-hud-container top-hud-container">
        {create_hud_box('p2', 'hud-opponent', 'vegeta', 'Vegeta')}
        {create_hud_box('p4', 'hud-opponent', 'frieza', 'Frieza', is_hidden=True)}
      </div>"""

    bot_hud_content = f"""
      <div id="bot-hud-container" class="scouter-hud-container bot-hud-container">
        {create_hud_box('p1', 'hud-player', 'goku', 'Son Goku')}
        {create_hud_box('p3', 'hud-player', 'piccolo', 'Piccolo', is_hidden=True)}
        {create_hud_box('p5', 'hud-player', 'gohan', 'Gohan', is_hidden=True)}
        {create_hud_box('p6', 'hud-player', 'trunks', 'Trunks', is_hidden=True)}
      </div>"""

    # Replace top container area in index.html
    # Look for turn-phase-bar down to drop-zone
    old_top_pattern = r'(<div id="turn-phase-bar"[\s\S]*?</div>\s*</div>)([\s\S]*?)(<!-- Zone Mid)'
    # Let's inspect exact HTML between turn-phase-bar and arena-zone-mid
    
    # We can match from <div id="turn-phase-bar" down to <div class="arena-zone-mid">
    pattern_top = r'(<div id="turn-phase-bar"[\s\S]*?</div>\s*</div>\s*)([\s\S]*?)(<div class="arena-zone-mid">)'
    
    def repl_top(match):
        return match.group(1) + "\n" + top_hud_content + "\n\n    " + match.group(3)

    html = re.sub(pattern_top, repl_top, html, count=1)

    # Replace bot container area in index.html
    # Look for <div class="arena-zone-bot"> down to <div class="action-row">
    pattern_bot = r'(<div class="arena-zone-bot">\s*)([\s\S]*?)(<div class="action-row">)'

    def repl_bot(match):
        return match.group(1) + bot_hud_content + "\n\n      " + match.group(3)

    html = re.sub(pattern_bot, repl_bot, html, count=1)

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(html)
    print("Updated index.html HUD containers successfully!")

if __name__ == '__main__':
    update_html_huds()
