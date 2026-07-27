import re

def inspect_js(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        text = f.read()
    print(f"=== {filepath} ===")
    methods = re.findall(r'([a-zA-Z0-9_]+)\s*\([^)]*\)\s*\{', text)
    print("Methods:", sorted(set(methods))[:30])

inspect_js('c:/dbtcg/js/game-engine.js')
inspect_js('c:/dbtcg/js/ui-manager.js')
