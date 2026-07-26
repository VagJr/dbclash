import os
from PIL import Image

artifacts_dir = 'C:/Users/vagmi/.gemini/antigravity-ide/brain/07a7fd72-44dd-4117-9527-46683382e456'
cards_dir = 'c:/dbtcg/assets/cards'
leaders_dir = 'c:/dbtcg/assets/leaders'

# Standard card size: most common cluster is ~116x166, we'll use a clean 120x170
# which preserves the TCG aspect ratio (5:7) used by the existing cards
CARD_W, CARD_H = 120, 170
LEADER_W, LEADER_H = 250, 360

# Sheet 1 (4x4 = 16 tiles): Attack cards atk_01 to atk_16
# Sheet 2 (4x4 = 16 tiles): Attack cards atk_17 to atk_28 + Defense def_01 to def_04
# Sheet 3 (4x4 = 16 tiles): Defense def_05 to def_15 + Evade evd_01 to evd_05
# Sheet 4 (4x4 = 16 tiles): Evade evd_06 to evd_09 + Counter ctr_01 to ctr_09 + Tech tch_01 to tch_03
# Sheet 5 (2x3 = 6 tiles): Tech tch_04 to tch_09

sheets_config = [
    {
        'path': os.path.join(artifacts_dir, 'collection_sheet_1_1785055034727.png'),
        'cols': 4, 'rows': 4,
        'cards': [
            'atk_01', 'atk_02', 'atk_03', 'atk_04',   # Row 1
            'atk_05', 'atk_06', 'atk_07', 'atk_08',   # Row 2
            'atk_09', 'atk_10', 'atk_11', 'atk_12',   # Row 3
            'atk_13', 'atk_14', 'atk_15', 'atk_16',   # Row 4
        ]
    },
    {
        'path': os.path.join(artifacts_dir, 'collection_sheet_2_1785055070166.png'),
        'cols': 4, 'rows': 4,
        'cards': [
            'atk_17', 'atk_18', 'atk_19', 'atk_20',   # Row 1
            'atk_21', 'atk_22', 'atk_23', 'atk_24',   # Row 2
            'atk_25', 'atk_26', 'atk_27', 'atk_28',   # Row 3
            'def_01', 'def_02', 'def_03', 'def_04',   # Row 4
        ]
    },
    {
        'path': os.path.join(artifacts_dir, 'collection_sheet_3_1785055106071.png'),
        'cols': 4, 'rows': 4,
        'cards': [
            'def_05', 'def_06', 'def_07', 'def_08',   # Row 1
            'def_09', 'def_10', 'def_11', 'def_12',   # Row 2
            'def_13', 'def_14', 'def_15', 'evd_01',   # Row 3
            'evd_02', 'evd_03', 'evd_04', 'evd_05',   # Row 4
        ]
    },
    {
        'path': os.path.join(artifacts_dir, 'collection_sheet_4_1785055144244.png'),
        'cols': 4, 'rows': 4,
        'cards': [
            'evd_06', 'evd_07', 'evd_08', 'evd_09',   # Row 1
            'ctr_01', 'ctr_02', 'ctr_03', 'ctr_04',   # Row 2
            'ctr_05', 'ctr_06', 'ctr_07', 'ctr_08',   # Row 3
            'ctr_09', 'tch_01', 'tch_02', 'tch_03',   # Row 4
        ]
    },
    {
        'path': os.path.join(artifacts_dir, 'collection_sheet_5_1785055178152.png'),
        'cols': 3, 'rows': 2,
        'cards': [
            'tch_04', 'tch_05', 'tch_06',   # Row 1
            'tch_07', 'tch_08', 'tch_09',   # Row 2
        ]
    },
]

leaders_config = {
    'path': os.path.join(artifacts_dir, 'leaders_sheet_1785055211121.png'),
    'cols': 4, 'rows': 3,
    'leaders': [
        ('goku.png', 'goku_awk.png', 'vegeta.png', 'vegeta_awk.png'),       # Row 1
        ('gohan.png', 'gohan_awk.png', 'frieza.png', 'frieza_awk.png'),      # Row 2
        ('piccolo.png', 'piccolo_awk.png', 'trunks.png', 'trunks_awk.png'),  # Row 3
    ]
}

print('=== PRECISION SLICING & INJECTION OF 70 CARDS + 12 LEADERS ===')

# Process 5 card sheets
total_cards = 0
for sheet in sheets_config:
    if not os.path.exists(sheet['path']):
        print(f"WARNING: Sheet not found: {sheet['path']}")
        continue
    
    img = Image.open(sheet['path'])
    sw, sh = img.size
    cols, rows = sheet['cols'], sheet['rows']
    tw, th = sw // cols, sh // rows
    
    idx = 0
    for r in range(rows):
        for c in range(cols):
            if idx >= len(sheet['cards']):
                break
            card_id = sheet['cards'][idx]
            idx += 1
            
            # Crop tile from sheet
            box = (c * tw, r * th, (c + 1) * tw, (r + 1) * th)
            tile = img.crop(box)
            
            # Resize to standard card dimensions preserving aspect ratio
            tile_resized = tile.resize((CARD_W, CARD_H), Image.Resampling.LANCZOS)
            
            target = os.path.join(cards_dir, f'{card_id}.png')
            tile_resized.save(target, 'PNG')
            total_cards += 1
            print(f'  [{total_cards:02d}] {card_id} -> {CARD_W}x{CARD_H}px')

print(f'\n>>> {total_cards} CARD TILES SLICED & INJECTED <<<')

# Process leaders sheet
if os.path.exists(leaders_config['path']):
    limg = Image.open(leaders_config['path'])
    lw, lh = limg.size
    lcols, lrows = leaders_config['cols'], leaders_config['rows']
    ltw, lth = lw // lcols, lh // lrows
    
    leader_count = 0
    for r, row_names in enumerate(leaders_config['leaders']):
        for c, fname in enumerate(row_names):
            box = (c * ltw, r * lth, (c + 1) * ltw, (r + 1) * lth)
            tile = limg.crop(box)
            tile_resized = tile.resize((LEADER_W, LEADER_H), Image.Resampling.LANCZOS)
            
            target = os.path.join(leaders_dir, fname)
            tile_resized.save(target, 'PNG')
            leader_count += 1
            print(f'  [Leader {leader_count:02d}] {fname} -> {LEADER_W}x{LEADER_H}px')
    
    # Also copy awaken variants for the _awaken naming convention
    for leader in ['goku', 'vegeta', 'gohan', 'frieza', 'piccolo', 'trunks']:
        awk_src = os.path.join(leaders_dir, f'{leader}_awk.png')
        awaken_dst = os.path.join(leaders_dir, f'{leader}_awaken.png')
        if os.path.exists(awk_src):
            import shutil
            shutil.copy(awk_src, awaken_dst)
    
    print(f'\n>>> {leader_count} LEADER PORTRAITS SLICED & INJECTED <<<')

print(f'\n>>> TOTAL: {total_cards} cards + {leader_count} leaders = {total_cards + leader_count} ASSETS COMPLETE! <<<')
