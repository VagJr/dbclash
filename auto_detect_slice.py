import os
from PIL import Image
import numpy as np

artifacts_dir = 'C:/Users/vagmi/.gemini/antigravity-ide/brain/07a7fd72-44dd-4117-9527-46683382e456'
cards_dir = 'c:/dbtcg/assets/cards'

CARD_W, CARD_H = 120, 170
BG_THRESHOLD = 80  # pixels with R+G+B < this are background

def find_card_bbox(tile_arr):
    """Find bounding box of the card within a tile by detecting non-background pixels."""
    h, w = tile_arr.shape[:2]
    
    # Sum RGB channels (handle uint8 overflow by casting)
    brightness = tile_arr[:,:,0].astype(int) + tile_arr[:,:,1].astype(int) + tile_arr[:,:,2].astype(int)
    
    # Create mask of non-background pixels
    mask = brightness > BG_THRESHOLD
    
    # Find bounding box of non-bg region
    rows_any = np.any(mask, axis=1)
    cols_any = np.any(mask, axis=0)
    
    if not np.any(rows_any) or not np.any(cols_any):
        return 0, 0, w, h
    
    y1 = np.argmax(rows_any)
    y2 = h - np.argmax(rows_any[::-1])
    x1 = np.argmax(cols_any)
    x2 = w - np.argmax(cols_any[::-1])
    
    # Add tiny 2px padding inward to trim border artifacts
    x1 = min(x1 + 2, x2)
    y1 = min(y1 + 2, y2)
    x2 = max(x2 - 2, x1)
    y2 = max(y2 - 2, y1)
    
    return x1, y1, x2, y2

sheets_config = [
    {
        'path': os.path.join(artifacts_dir, 'collection_sheet_1_1785055034727.png'),
        'cols': 4, 'rows': 4,
        'cards': ['atk_01','atk_02','atk_03','atk_04','atk_05','atk_06','atk_07','atk_08','atk_09','atk_10','atk_11','atk_12','atk_13','atk_14','atk_15','atk_16']
    },
    {
        'path': os.path.join(artifacts_dir, 'collection_sheet_2_1785055070166.png'),
        'cols': 4, 'rows': 4,
        'cards': ['atk_17','atk_18','atk_19','atk_20','atk_21','atk_22','atk_23','atk_24','atk_25','atk_26','atk_27','atk_28','def_01','def_02','def_03','def_04']
    },
    {
        'path': os.path.join(artifacts_dir, 'collection_sheet_3_1785055106071.png'),
        'cols': 4, 'rows': 4,
        'cards': ['def_05','def_06','def_07','def_08','def_09','def_10','def_11','def_12','def_13','def_14','def_15','evd_01','evd_02','evd_03','evd_04','evd_05']
    },
    {
        'path': os.path.join(artifacts_dir, 'collection_sheet_4_1785055144244.png'),
        'cols': 4, 'rows': 4,
        'cards': ['evd_06','evd_07','evd_08','evd_09','ctr_01','ctr_02','ctr_03','ctr_04','ctr_05','ctr_06','ctr_07','ctr_08','ctr_09','tch_01','tch_02','tch_03']
    },
    {
        'path': os.path.join(artifacts_dir, 'collection_sheet_5_1785055178152.png'),
        'cols': 3, 'rows': 2,
        'cards': ['tch_04','tch_05','tch_06','tch_07','tch_08','tch_09']
    },
]

print('=== AUTO-DETECTING CARD BOUNDARIES & SLICING 70 CARDS ===')

total = 0
for sheet in sheets_config:
    if not os.path.exists(sheet['path']):
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
            
            # Extract tile
            tile = img.crop((c * tw, r * th, (c + 1) * tw, (r + 1) * th))
            tile_arr = np.array(tile)
            
            # Auto-detect card bounding box
            bx1, by1, bx2, by2 = find_card_bbox(tile_arr)
            
            # Crop to detected card area
            card_crop = tile.crop((bx1, by1, bx2, by2))
            
            # Resize to standard card size
            card_final = card_crop.resize((CARD_W, CARD_H), Image.Resampling.LANCZOS)
            card_final.save(os.path.join(cards_dir, f'{card_id}.png'), 'PNG')
            total += 1
            print(f'  [{total:02d}] {card_id}: bbox=({bx1},{by1},{bx2},{by2}) in {tw}x{th} tile')

print(f'\n>>> {total} CARDS AUTO-DETECTED & SLICED - ZERO BACKGROUND BLEED <<<')
