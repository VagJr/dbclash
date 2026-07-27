import cv2
import numpy as np
import os
from PIL import Image

root = 'c:/dbtcg'
cards_dir = 'c:/dbtcg/assets/cards'
leaders_dir = 'c:/dbtcg/assets/leaders'

os.makedirs(cards_dir, exist_ok=True)
os.makedirs(leaders_dir, exist_ok=True)

CARD_W, CARD_H = 120, 170
LEADER_W, LEADER_H = 250, 360

sheets_config = [
    {
        'path': os.path.join(root, 'collection_sheet_1.png'),
        'cards': [
            'atk_01', 'atk_02', 'atk_03', 'atk_04',
            'atk_05', 'atk_06', 'atk_07', 'atk_08',
            'atk_09', 'atk_10', 'atk_11', 'atk_12',
            'atk_13', 'atk_14', 'atk_15', 'atk_16',
        ]
    },
    {
        'path': os.path.join(root, 'collection_sheet_2.png'),
        'cards': [
            'atk_17', 'atk_18', 'atk_19', 'atk_20',
            'atk_21', 'atk_22', 'atk_23', 'atk_24',
            'atk_25', 'atk_26', 'atk_27', 'atk_28',
            'def_01', 'def_02', 'def_03', 'def_04',
        ]
    },
    {
        'path': os.path.join(root, 'collection_sheet_3.png'),
        'cards': [
            'def_05', 'def_06', 'def_07', 'def_08',
            'def_09', 'def_10', 'def_11', 'def_12',
            'def_13', 'def_14', 'def_15', 'evd_01',
            'evd_02', 'evd_03', 'evd_04', 'evd_05',
        ]
    },
    {
        'path': os.path.join(root, 'collection_sheet_4.png'),
        'cards': [
            'evd_06', 'evd_07', 'evd_08', 'evd_09',
            'ctr_01', 'ctr_02', 'ctr_03', 'ctr_04',
            'ctr_05', 'ctr_06', 'ctr_07', 'ctr_08',
            'ctr_09', 'tch_01', 'tch_02', 'tch_03',
        ]
    }
]

def extract_rectangles(img_path, expected_count):
    img = cv2.imread(img_path)
    if img is None:
        return []
    
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    _, thresh = cv2.threshold(gray, 50, 255, cv2.THRESH_BINARY)
    contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    rects = []
    for c in contours:
        x, y, w, h = cv2.boundingRect(c)
        area = w * h
        if 20000 < area < 100000:
            if 0.5 < w/h < 0.9:
                rects.append((x, y, w, h))
                
    # If we didn't find the exact count, sort by area and take top `expected_count`
    if len(rects) != expected_count:
        print(f"Warning: Found {len(rects)} rects in {img_path}, expected {expected_count}")
        contours_sorted = sorted(contours, key=cv2.contourArea, reverse=True)
        rects = []
        for c in contours_sorted:
            x, y, w, h = cv2.boundingRect(c)
            if len(rects) >= expected_count: break
            if w/h < 1.0: # Ensure it's portrait
                rects.append((x, y, w, h))
                
    # Sort into rows and cols
    # Sort by Y first, then group into rows
    rects.sort(key=lambda b: b[1])
    sorted_rects = []
    row_len = expected_count // 4 if expected_count == 16 else expected_count // 3
    if expected_count == 12: row_len = 4
    
    for i in range(0, expected_count, row_len):
        row = rects[i:i+row_len]
        row.sort(key=lambda b: b[0])
        sorted_rects.extend(row)
        
    return sorted_rects

for sheet in sheets_config:
    path = sheet['path']
    if not os.path.exists(path): continue
    
    print(f"Processing {os.path.basename(path)}...")
    rects = extract_rectangles(path, 16)
    
    pil_img = Image.open(path).convert('RGBA')
    
    for i, (x, y, w, h) in enumerate(rects):
        if i >= len(sheet['cards']): break
        card_id = sheet['cards'][i]
        
        # The user wants NO bleeding and no dark margins around it.
        # We will add an inset of 4 pixels to the bounding box to be absolutely sure we don't catch the background
        inset = 4
        crop_box = (x + inset, y + inset, x + w - inset, y + h - inset)
        
        card_img = pil_img.crop(crop_box)
        card_img = card_img.resize((CARD_W, CARD_H), Image.Resampling.LANCZOS)
        
        out_path = os.path.join(cards_dir, f'{card_id}.png')
        card_img.save(out_path, 'PNG')
        print(f"  Saved {card_id} (cropped {w}x{h} at {x},{y})")

# Leaders
leaders_path = os.path.join(root, 'leaders_sheet.png')
if os.path.exists(leaders_path):
    print("Processing leaders_sheet.png...")
    rects = extract_rectangles(leaders_path, 12)
    pil_img = Image.open(leaders_path).convert('RGBA')
    
    leaders = [
        'goku.png', 'goku_awk.png', 'vegeta.png', 'vegeta_awk.png',
        'gohan.png', 'gohan_awk.png', 'frieza.png', 'frieza_awk.png',
        'piccolo.png', 'piccolo_awk.png', 'trunks.png', 'trunks_awk.png'
    ]
    
    for i, (x, y, w, h) in enumerate(rects):
        if i >= len(leaders): break
        leader_id = leaders[i]
        
        inset = 5
        crop_box = (x + inset, y + inset, x + w - inset, y + h - inset)
        
        l_img = pil_img.crop(crop_box)
        l_img = l_img.resize((LEADER_W, LEADER_H), Image.Resampling.LANCZOS)
        
        out_path = os.path.join(leaders_dir, leader_id)
        l_img.save(out_path, 'PNG')
        print(f"  Saved {leader_id}")
        
    # Copy awaken
    import shutil
    for leader in ['goku', 'vegeta', 'gohan', 'frieza', 'piccolo', 'trunks']:
        awk_src = os.path.join(leaders_dir, f'{leader}_awk.png')
        awaken_dst = os.path.join(leaders_dir, f'{leader}_awaken.png')
        if os.path.exists(awk_src):
            shutil.copy(awk_src, awaken_dst)
