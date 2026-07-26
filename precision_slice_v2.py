import os
from PIL import Image
import shutil

artifacts_dir = 'C:/Users/vagmi/.gemini/antigravity-ide/brain/07a7fd72-44dd-4117-9527-46683382e456'
cards_dir = 'c:/dbtcg/assets/cards'
leaders_dir = 'c:/dbtcg/assets/leaders'

CARD_W, CARD_H = 120, 170
LEADER_W, LEADER_H = 250, 360

sheets_config = [
    {
        'path': os.path.join(artifacts_dir, 'collection_sheet_1_1785055034727.png'),
        'cols': 4, 'rows': 4,
        'cards': [
            'atk_01', 'atk_02', 'atk_03', 'atk_04',
            'atk_05', 'atk_06', 'atk_07', 'atk_08',
            'atk_09', 'atk_10', 'atk_11', 'atk_12',
            'atk_13', 'atk_14', 'atk_15', 'atk_16',
        ]
    },
    {
        'path': os.path.join(artifacts_dir, 'collection_sheet_2_1785055070166.png'),
        'cols': 4, 'rows': 4,
        'cards': [
            'atk_17', 'atk_18', 'atk_19', 'atk_20',
            'atk_21', 'atk_22', 'atk_23', 'atk_24',
            'atk_25', 'atk_26', 'atk_27', 'atk_28',
            'def_01', 'def_02', 'def_03', 'def_04',
        ]
    },
    {
        'path': os.path.join(artifacts_dir, 'collection_sheet_3_1785055106071.png'),
        'cols': 4, 'rows': 4,
        'cards': [
            'def_05', 'def_06', 'def_07', 'def_08',
            'def_09', 'def_10', 'def_11', 'def_12',
            'def_13', 'def_14', 'def_15', 'evd_01',
            'evd_02', 'evd_03', 'evd_04', 'evd_05',
        ]
    },
    {
        'path': os.path.join(artifacts_dir, 'collection_sheet_4_1785055144244.png'),
        'cols': 4, 'rows': 4,
        'cards': [
            'evd_06', 'evd_07', 'evd_08', 'evd_09',
            'ctr_01', 'ctr_02', 'ctr_03', 'ctr_04',
            'ctr_05', 'ctr_06', 'ctr_07', 'ctr_08',
            'ctr_09', 'tch_01', 'tch_02', 'tch_03',
        ]
    },
    {
        'path': os.path.join(artifacts_dir, 'collection_sheet_5_1785055178152.png'),
        'cols': 3, 'rows': 2,
        'cards': [
            'tch_04', 'tch_05', 'tch_06',
            'tch_07', 'tch_08', 'tch_09',
        ]
    },
]

leaders_config = {
    'path': os.path.join(artifacts_dir, 'leaders_sheet_1785055211121.png'),
    'cols': 4, 'rows': 3,
    'leaders': [
        ('goku.png', 'goku_awk.png', 'vegeta.png', 'vegeta_awk.png'),
        ('gohan.png', 'gohan_awk.png', 'frieza.png', 'frieza_awk.png'),
        ('piccolo.png', 'piccolo_awk.png', 'trunks.png', 'trunks_awk.png'),
    ]
}

# Inset margin as a fraction of tile width/height to trim neighbor bleed
INSET_FRAC = 0.06  # 6% inset from each edge

print('=== PRECISION SLICING WITH INSET MARGIN (NO NEIGHBOR BLEED) ===')

total_cards = 0
for sheet in sheets_config:
    if not os.path.exists(sheet['path']):
        print(f"WARNING: Sheet not found: {sheet['path']}")
        continue
    
    img = Image.open(sheet['path'])
    sw, sh = img.size
    cols, rows = sheet['cols'], sheet['rows']
    tw, th = sw // cols, sh // rows
    
    # Calculate inset pixels
    ix = int(tw * INSET_FRAC)
    iy = int(th * INSET_FRAC)
    
    idx = 0
    for r in range(rows):
        for c in range(cols):
            if idx >= len(sheet['cards']):
                break
            card_id = sheet['cards'][idx]
            idx += 1
            
            # Crop tile with inset margin
            x1 = c * tw + ix
            y1 = r * th + iy
            x2 = (c + 1) * tw - ix
            y2 = (r + 1) * th - iy
            
            tile = img.crop((x1, y1, x2, y2))
            tile_resized = tile.resize((CARD_W, CARD_H), Image.Resampling.LANCZOS)
            
            target = os.path.join(cards_dir, f'{card_id}.png')
            tile_resized.save(target, 'PNG')
            total_cards += 1

print(f'>>> {total_cards} CARD TILES SLICED WITH CLEAN INSET MARGINS <<<')

# Process leaders
if os.path.exists(leaders_config['path']):
    limg = Image.open(leaders_config['path'])
    lw, lh = limg.size
    lcols, lrows = leaders_config['cols'], leaders_config['rows']
    ltw, lth = lw // lcols, lh // lrows
    lix = int(ltw * INSET_FRAC)
    liy = int(lth * INSET_FRAC)
    
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
    
    # Copy awaken variants
    for leader in ['goku', 'vegeta', 'gohan', 'frieza', 'piccolo', 'trunks']:
        awk_src = os.path.join(leaders_dir, f'{leader}_awk.png')
        awaken_dst = os.path.join(leaders_dir, f'{leader}_awaken.png')
        if os.path.exists(awk_src):
            shutil.copy(awk_src, awaken_dst)
    
    print(f'>>> {leader_count} LEADER PORTRAITS SLICED WITH CLEAN INSET MARGINS <<<')

print(f'\n>>> TOTAL: {total_cards} cards + {leader_count} leaders = ALL ASSETS COMPLETE! <<<')
