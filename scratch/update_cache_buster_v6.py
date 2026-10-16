import os

def update_cache_buster():
    filepath = 'c:/dbtcg/index.html'
    with open(filepath, 'r', encoding='utf-8') as f:
        html = f.read()

    html = html.replace('?v=v5_layout_fix', '?v=v6_fix_render_hand')

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(html)
    print("Updated index.html cache busters to v6_fix_render_hand!")

if __name__ == '__main__':
    update_cache_buster()
