import os
import re

cards_dir = 'c:/dbtcg/assets/cards'
existing_files = set(os.listdir(cards_dir))

with open('c:/dbtcg/js/card-database.js', 'r', encoding='utf-8') as f:
    text = f.read()

card_ids = re.findall(r"id:\s*'([^']+)'", text)
card_ids = [cid for cid in card_ids if cid not in ['goku', 'vegeta', 'gohan', 'frieza', 'piccolo', 'trunks']]

print(f'Found {len(card_ids)} playable card IDs in CARD_DATABASE.')
missing = []
for cid in card_ids:
    png = f'{cid}.png'
    if png not in existing_files:
        missing.append(png)

if missing:
    print('Missing PNG files:', missing)
else:
    print('ALL 70 CARDS HAVE MATCHING PNG FILES IN ASSETS/CARDS/!')
