import os
import shutil
from PIL import Image
import numpy as np

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

def detect_exact_card_bounds(tile_img):
    """Find the exact inner bounding box of the card frame inside a grid tile."""
    arr = np.array(tile_img)
    h, w, _ = arr.shape
    
    # Calculate brightness (sum of R+G+B)
    brightness = arr[:, :, :3].astype(int).sum(axis=2)
    
    # Background threshold: dark blue sheet background has R+G+B < 85
    card_mask = brightness > 85
    
    rows_with_card = np.any(card_mask, axis=1)
    cols_with_card = np.any(card_mask, axis=0)
    
    if not np.any(rows_with_card) or not np.any(cols_with_card):
        return 0, 0, w, h
    
    y_min = int(np.argmax(rows_with_card))
    y_max = int(h - np.argmax(rows_with_card[::-1]))
    x_min = int(np.argmax(cols_with_card))
    x_max = int(w - np.argmax(cols_with_card[::-1]))
    
    # Add 1px inward padding to trim any outer background edge
    x_min = min(x_min + 1, x_max - 10)
    y_min = min(y_min + 1, y_max - 10)
    x_max = max(x_max - 1, x_min + 10)
    y_max = max(y_max - 1, y_min + 10)
    
    return x_min, y_min, x_max, y_max

print('=== EXACT BOUNDING BOX CROP FOR ROOT SHEETS ===')

total_cards = 0
for sheet in sheets_config:
    if not os.path.exists(sheet['path']):
        continue
    
    img = Image.open(sheet['path']).convert('RGB')
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
            
            # Crop grid tile
            tile = img.crop((c * tw, r * th, (c + 1) * tw, (r + 1) * th))
            
            # Detect exact card bounds inside tile
            x1, y1, x2, y2 = detect_exact_card_bounds(tile)
            card_crop = tile.crop((x1, y1, x2, y2))
            
            # Resize clean card to standard TCG card dimensions
            final_card = card_crop.resize((CARD_W, CARD_H), Image.Resampling.LANCZOS)
            target = os.path.join(cards_dir, f'{card_id}.png')
            final_card.save(target, 'PNG')
            total_cards += 1
            print(f'  [{total_cards:02d}] {card_id}: bounds=({x1},{y1},{x2},{y2}) -> {CARD_W}x{CARD_H}px')

print(f'\n>>> {total_cards} CARDS CROPPED WITH EXACT BOUNDS <<<')

# Process leaders sheet
if os.path.exists(leaders_config['path']):
    limg = Image.open(leaders_config['path']).convert('RGB')
    lw, lh = limg.size
    lcols, lrows = leaders_config['cols'], leaders_config['rows']
    ltw, lth = lw // lcols, lh // lrows
    
    leader_count = 0
    for r, row_names in enumerate(leaders_config['leaders']):
        for c, fname in enumerate(row_names):
            ltile = limg.crop((c * ltw, r * lth, (c + 1) * ltw, (r + 1) * lth))
            lx1, ly1, lx2, ly2 = detect_exact_card_bounds(ltile)
            lcrop = ltile.crop((lx1, ly1, lx2, ly2))
            lfinal = lcrop.resize((LEADER_W, LEADER_H), Image.Resampling.LANCZOS)
            
            target = os.path.join(leaders_dir, fname)
            lfinal.save(target, 'PNG')
            leader_count += 1
            print(f'  [Leader {leader_count:02d}] {fname}: bounds=({lx1},{ly1},{lx2},{ly2}) -> {LEADER_W}x{LEADER_H}px')
            
    # Copy awaken variants for _awaken convention
    for leader in ['goku', 'vegeta', 'gohan', 'frieza', 'piccolo', 'trunks']:
        awk_src = os.path.join(leaders_dir, f'{leader}_awk.png')
        awaken_dst = os.path.join(leaders_dir, f'{leader}_awaken.png')
        if os.path.exists(awk_src):
            shutil.copy(awk_src, awaken_dst)

print(f'\n>>> TOTAL PROCESSED: {total_cards} CARDS + {leader_count} LEADERS WITH EXACT DYNAMIC BOUNDS! <<<')
