import os

def fix_multiplayer_notify():
    filepath = 'c:/dbtcg/js/multiplayer-manager.js'
    with open(filepath, 'r', encoding='utf-8') as f:
        js = f.read()

    # 1. Update fallbackToBot2v2 to notify state
    old_2v2 = """    this.engine.turnOrder = ['p1', 'p2', 'p3', 'p4'];

    sceneManager.switchScene(GAME_SCENES.ARENA);"""

    new_2v2 = """    this.engine.turnOrder = ['p1', 'p2', 'p3', 'p4'];

    sceneManager.switchScene(GAME_SCENES.ARENA);
    this.engine.notifyState();"""

    js = js.replace(old_2v2, new_2v2)

    # 2. Update fallbackToBotRaid to notify state
    old_raid = """    // Turn order: 4 Warriors -> Boss
    this.engine.turnOrder = ['p1', 'p3', 'p5', 'p6', 'p2'];

    sceneManager.switchScene(GAME_SCENES.ARENA);"""

    new_raid = """    // Turn order: 4 Warriors -> Boss
    this.engine.turnOrder = ['p1', 'p3', 'p5', 'p6', 'p2'];

    sceneManager.switchScene(GAME_SCENES.ARENA);
    this.engine.notifyState();"""

    js = js.replace(old_raid, new_raid)

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(js)
    print("Successfully added notifyState() calls to fallbackToBot2v2 and fallbackToBotRaid!")

if __name__ == '__main__':
    fix_multiplayer_notify()
