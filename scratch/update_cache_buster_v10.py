import os

def update_v10():
    # 1. Update js/ui-manager.js import
    ui_path = 'c:/dbtcg/js/ui-manager.js'
    with open(ui_path, 'r', encoding='utf-8') as f:
        ui = f.read()

    ui = ui.replace(
        "import { MultiplayerManager } from './multiplayer-manager.js?v=v9_force_clear';",
        "import { MultiplayerManager } from './multiplayer-manager.js?v=v10_clear_matchmaking_verified';"
    )
    ui = ui.replace(
        "import { MultiplayerManager } from './multiplayer-manager.js';",
        "import { MultiplayerManager } from './multiplayer-manager.js?v=v10_clear_matchmaking_verified';"
    )

    with open(ui_path, 'w', encoding='utf-8') as f:
        f.write(ui)
    print("Updated js/ui-manager.js import to v10!")

    # 2. Update index.html
    html_path = 'c:/dbtcg/index.html'
    with open(html_path, 'r', encoding='utf-8') as f:
        html = f.read()

    html = html.replace('?v=v9_force_clear', '?v=v10_clear_matchmaking_verified')
    html = html.replace('?v=v8_fix_clearmatchmaking', '?v=v10_clear_matchmaking_verified')

    with open(html_path, 'w', encoding='utf-8') as f:
        f.write(html)
    print("Updated index.html to v10!")

if __name__ == '__main__':
    update_v10()
