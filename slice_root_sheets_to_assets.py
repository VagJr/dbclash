import os
import shutil
from PIL import Image

root = 'c:/dbtcg'
cards_dir = 'c:/dbtcg/assets/cards'
leaders_dir = 'c:/dbtcg/assets/leaders'

CARD_W, CARD_H = 120, 170
LEADER_W, LEADER_H = 250, 360

sheets_config = [
    {
        'path': os.path.join(root, 'collection_sheet_1.png'),
        'cols': 4, 'rows': 4,
        'cards': [
            'atk_01', 'atk_02', 'atk_03', 'atk_04',
            'atk_05', 'atk_06', 'atk_07', 'atk_08',
            'atk_09', 'atk_10', 'atk_11', 'atk_12',
            'atk_13', 'atk_14', 'atk_15', 'atk_16',
        ]
    },
    {
        'path': os.path.join(root, 'collection_sheet_2.png'),
        'cols': 4, 'rows': 4,
        'cards': [
            'atk_17', 'atk_18', 'atk_19', 'atk_20',
            'atk_21', 'atk_22', 'atk_23', 'atk_24',
            'atk_25', 'atk_26', 'atk_27', 'atk_28',
            'def_01', 'def_02', 'def_03', 'def_04',
        ]
    },
    {
        'path': os.path.join(root, 'collection_sheet_3.png'),
        'cols': 4, 'rows': 4,
        'cards': [
            'def_05', 'def_06', 'def_07', 'def_08',
            'def_09', 'def_10', 'def_11', 'def_12',
            'def_13', 'def_14', 'def_15', 'evd_01',
            'evd_02', 'evd_03', 'evd_04', 'evd_05',
        ]
    },
    {
        'path': os.path.join(root, 'collection_sheet_4.png'),
        'cols': 4, 'rows': 4,
        'cards': [
            'evd_06', 'evd_07', 'evd_08', 'evd_09',
            'ctr_01', 'ctr_02', 'ctr_03', 'ctr_04',
            'ctr_05', 'ctr_06', 'ctr_07', 'ctr_08',
            'ctr_09', 'tch_01', 'tch_02', 'tch_03',
        ]
    }
]

leaders_config = {
    'path': os.path.join(root, 'leaders_sheet.png'),
    'cols': 4, 'rows': 3,
    'leaders': [
        ('goku.png', 'goku_awk.png', 'vegeta.png', 'vegeta_awk.png'),
        ('gohan.png', 'gohan_awk.png', 'frieza.png', 'frieza_awk.png'),
        ('piccolo.png', 'piccolo_awk.png', 'trunks.png', 'trunks_awk.png'),
    ]
}

print('=== PRECISION SLICING ROOT SHEETS (collection_sheet_1-4 & leaders_sheet) ===')

total_cards = 0
for sheet in sheets_config:
    if not os.path.exists(sheet['path']):
        print(f"WARNING: Sheet not found: {sheet['path']}")
        continue
    
    img = Image.open(sheet['path'])
    sw, sh = img.size
    cols, rows = sheet['cols'], sheet['rows']
    tw, th = sw // cols, sh // rows
    
    # 7% inset on all edges to cleanly isolate card frames
    ix = int(tw * 0.07)
    iy = int(th * 0.07)
    
    idx = 0
    for r in range(rows):
        for c in range(cols):
            if idx >= len(sheet['cards']):
                break
            card_id = sheet['cards'][idx]
            idx += 1
            
            x1 = c * tw + ix
            y1 = r * th + iy
            x2 = (c + 1) * tw - ix
            y2 = (r + 1) * th - ix
            
            tile = img.crop((x1, y1, x2, y2))
            tile_resized = tile.resize((CARD_W, CARD_H), Image.Resampling.LANCZOS)
            
            target = os.path.join(cards_dir, f'{card_id}.png')
            tile_resized.save(target, 'PNG')
            total_cards += 1
            print(f'  [{total_cards:02d}] {card_id} -> {CARD_W}x{CARD_H}px')

print(f'\n>>> {total_cards} CARD TILES SLICED FROM ROOT SHEETS <<<')

# Process leaders sheet
if os.path.exists(leaders_config['path']):
    limg = Image.open(leaders_config['path'])
    lw, lh = limg.size
    lcols, lrows = leaders_config['cols'], leaders_config['rows']
    ltw, lth = lw // lcols, lh // lrows
    
    lix = int(ltw * 0.05)
    liy = int(lth * 0.05)
    
    leader_count = 0
    for r, row_names in enumerate(leaders_config['leaders']):
        for c, fname in enumerate(row_names):
            x1 = c * ltw + lix
            y1 = r * lth + liy
            x2 = (c + 1) * ltw - lix
            y2 = (r + 1) * lth - liy
            
            tile = limg.crop((x1, y1, x2, y2))
            tile_resized = tile.resize((LEADER_W, LEADER_H), Image.Resampling.LANCZOS)
            
            target = os.path.join(leaders_dir, fname)
            tile_resized.save(target, 'PNG')
            leader_count += 1
            print(f'  [Leader {leader_count:02d}] {fname} -> {LEADER_W}x{LEADER_H}px')
    
    # Copy awaken variants for _awaken convention
    for leader in ['goku', 'vegeta', 'gohan', 'frieza', 'piccolo', 'trunks']:
        awk_src = os.path.join(leaders_dir, f'{leader}_awk.png')
        awaken_dst = os.path.join(leaders_dir, f'{leader}_awaken.png')
        if os.path.exists(awk_src):
            shutil.copy(awk_src, awaken_dst)
    
    print(f'\n>>> {leader_count} LEADER PORTRAITS SLICED FROM ROOT SHEET <<<')

print(f'\n>>> TOTAL SLICED: {total_cards} CARDS + {leader_count} LEADERS! <<<')
