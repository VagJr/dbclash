import os

def update_imports_v9():
    # 1. Update js/ui-manager.js
    ui_path = 'c:/dbtcg/js/ui-manager.js'
    with open(ui_path, 'r', encoding='utf-8') as f:
        ui = f.read()

    ui = ui.replace(
        "import { MultiplayerManager } from './multiplayer-manager.js';",
        "import { MultiplayerManager } from './multiplayer-manager.js?v=v9_force_clear';"
    )

    with open(ui_path, 'w', encoding='utf-8') as f:
        f.write(ui)
    print("Updated import in js/ui-manager.js!")

    # 2. Update index.html
    html_path = 'c:/dbtcg/index.html'
    with open(html_path, 'r', encoding='utf-8') as f:
        html = f.read()

    html = html.replace('?v=v8_fix_clearmatchmaking', '?v=v9_force_clear')
    html = html.replace('?v=v7_fix_render_player_hand', '?v=v9_force_clear')

    with open(html_path, 'w', encoding='utf-8') as f:
        f.write(html)
    print("Updated script tags in index.html to v9_force_clear!")

if __name__ == '__main__':
    update_imports_v9()
