import os

def update_cache_buster():
    filepath = 'c:/dbtcg/index.html'
    with open(filepath, 'r', encoding='utf-8') as f:
        html = f.read()

    html = html.replace('?v=v7_fix_render_player_hand', '?v=v8_fix_clearmatchmaking')

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(html)
    print("Updated index.html cache buster to v8_fix_clearmatchmaking!")

if __name__ == '__main__':
    update_cache_buster()
