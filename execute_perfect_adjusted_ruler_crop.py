import os
import shutil
from PIL import Image

root = 'c:/dbtcg'
cards_dir = 'c:/dbtcg/assets/cards'
leaders_dir = 'c:/dbtcg/assets/leaders'

CARD_W, CARD_H = 170, 228
LEADER_W, LEADER_H = 250, 360

# Surgically Perfect Adjusted Ruler Coordinates (Zero Right Border Overhang)
COL_LEFTS = [122, 319, 516, 713]
ROW_TOPS  = [24, 268, 512, 756]

sheets_config = [
    {
        'path': os.path.join(root, 'collection_sheet_1.png'),
        'cards': [
            ['atk_01', 'atk_02', 'atk_03', 'atk_04'],
            ['atk_05', 'atk_06', 'atk_07', 'atk_08'],
            ['atk_09', 'atk_10', 'atk_11', 'atk_12'],
            ['atk_13', 'atk_14', 'atk_15', 'atk_16']
        ]
    },
    {
        'path': os.path.join(root, 'collection_sheet_2.png'),
        'cards': [
            ['atk_17', 'atk_18', 'atk_19', 'atk_20'],
            ['atk_21', 'atk_22', 'atk_23', 'atk_24'],
            ['atk_25', 'atk_26', 'atk_27', 'atk_28'],
            ['def_01', 'def_02', 'def_03', 'def_04']
        ]
    },
    {
        'path': os.path.join(root, 'collection_sheet_3.png'),
        'cards': [
            ['def_05', 'def_06', 'def_07', 'def_08'],
            ['def_09', 'def_10', 'def_11', 'def_12'],
            ['def_13', 'def_14', 'def_15', 'evd_01'],
            ['evd_02', 'evd_03', 'evd_04', 'evd_05']
        ]
    },
    {
        'path': os.path.join(root, 'collection_sheet_4.png'),
        'cards': [
            ['evd_06', 'evd_07', 'evd_08', 'evd_09'],
            ['ctr_01', 'ctr_02', 'ctr_03', 'ctr_04'],
            ['ctr_05', 'ctr_06', 'ctr_07', 'ctr_08'],
            ['ctr_09', 'tch_01', 'tch_02', 'tch_03']
        ]
    }
]

leader_grid = [
    ['goku.png', 'goku_awk.png', 'vegeta.png', 'vegeta_awk.png'],
    ['gohan.png', 'gohan_awk.png', 'frieza.png', 'frieza_awk.png'],
    ['piccolo.png', 'piccolo_awk.png', 'trunks.png', 'trunks_awk.png']
]

print('=== EXECUTING PERFECTLY ADJUSTED RULER CROP (ZERO RIGHT BORDER OVERHANG) ===')

total_cards = 0
for sheet in sheets_config:
    if not os.path.exists(sheet['path']):
        continue
    
    img = Image.open(sheet['path']).convert('RGB')
    
    for r_idx, row in enumerate(sheet['cards']):
        top = ROW_TOPS[r_idx]
        for c_idx, card_id in enumerate(row):
            left = COL_LEFTS[c_idx]
            
            box = (left, top, left + CARD_W, top + CARD_H)
            tile = img.crop(box)
            
            target = os.path.join(cards_dir, f'{card_id}.png')
            tile.save(target, 'PNG')
            total_cards += 1
            print(f'  [{total_cards:02d}] {card_id}: adjusted bounds ({left}, {top}, {left + CARD_W}, {top + CARD_H}) -> Saved!')

print(f'\n>>> {total_cards} CARDS CROPPED WITH PERFECT ADJUSTED RULER! <<<')

# Process leaders sheet
leaders_path = os.path.join(root, 'leaders_sheet.png')
if os.path.exists(leaders_path):
    limg = Image.open(leaders_path).convert('RGB')
    leader_count = 0
    
    for r_idx, row in enumerate(leader_grid):
        top = ROW_TOPS[r_idx]
        for c_idx, fname in enumerate(row):
            left = COL_LEFTS[c_idx]
            
            box = (left, top, left + CARD_W, top + CARD_H)
            tile = limg.crop(box)
            tile_resized = tile.resize((LEADER_W, LEADER_H), Image.Resampling.LANCZOS)
            
            target = os.path.join(leaders_dir, fname)
            tile_resized.save(target, 'PNG')
            leader_count += 1
            print(f'  [Leader {leader_count:02d}] {fname}: adjusted bounds ({left}, {top}, {left + CARD_W}, {top + CARD_H}) -> Saved!')
            
    # Copy awaken variants for _awaken naming convention
    for leader in ['goku', 'vegeta', 'gohan', 'frieza', 'piccolo', 'trunks']:
        awk_src = os.path.join(leaders_dir, f'{leader}_awk.png')
        awaken_dst = os.path.join(leaders_dir, f'{leader}_awaken.png')
        if os.path.exists(awk_src):
            shutil.copy(awk_src, awaken_dst)

    print(f'\n>>> {leader_count} LEADER PORTRAITS CROPPED WITH PERFECT ADJUSTED RULER! <<<')

print(f'\n>>> TOTAL PROCESSED: {total_cards} CARDS + {leader_count} LEADERS WITH PERFECT ALIGNMENT! <<<')
