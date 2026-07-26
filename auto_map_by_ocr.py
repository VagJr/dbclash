import cv2
import easyocr
import difflib
import re
import os
import glob
import warnings
warnings.filterwarnings('ignore', category=UserWarning)

os.makedirs('c:/dbtcg/assets/leaders', exist_ok=True)
os.makedirs('c:/dbtcg/assets/cards', exist_ok=True)

with open('c:/dbtcg/js/card-database.js', 'r', encoding='utf-8') as f:
    db_text = f.read()

matches = re.findall(r"id:\s*'([^']+)',\s*name:\s*'([^']+)'", db_text)
db_cards = {m[0]: m[1] for m in matches}
leaders = {
    'goku': 'Son Goku', 'vegeta': 'Vegeta', 'gohan': 'Gohan',
    'frieza': 'Frieza', 'piccolo': 'Piccolo', 'trunks': 'Trunks',
    'goku_awk': 'SSJ Goku', 'vegeta_awk': 'SSJ Vegeta', 'gohan_awk': 'SSJ2 Gohan',
    'frieza_awk': 'Golden Frieza', 'piccolo_awk': 'Orange Piccolo', 'trunks_awk': 'SSJ Rage Trunks'
}
db_cards.update(leaders)

reader = easyocr.Reader(['en', 'pt'], gpu=False, verbose=False)

def find_exact_card_in_region(img_full, search_box, thresh_val=25):
    sx, sy, sw, sh = search_box
    cell = img_full[sy:sy+sh, sx:sx+sw]
    gray = cv2.cvtColor(cell, cv2.COLOR_BGR2GRAY)
    _, thresh = cv2.threshold(gray, thresh_val, 255, cv2.THRESH_BINARY)
    
    contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if contours:
        c = max(contours, key=cv2.contourArea)
        cx, cy, cw, ch = cv2.boundingRect(c)
        if cw > 40 and ch > 60:
            return cell[cy:cy+ch, cx:cx+cw]
    return cell

def read_title(cell):
    h, w = cell.shape[:2]
    top = cell[0:int(h*0.45), :]
    top_large = cv2.resize(top, (0,0), fx=2, fy=2, interpolation=cv2.INTER_CUBIC)
    
    results = reader.readtext(top_large)
    text = ' '.join([res[1] for res in results])
    
    best_id = None
    best_score = 0
    
    for cid, cname in db_cards.items():
        score1 = difflib.SequenceMatcher(None, text.lower(), cname.lower()).ratio()
        tw = set(re.findall(r'\w+', text.lower()))
        cw = set(re.findall(r'\w+', cname.lower()))
        score2 = len(tw.intersection(cw)) / float(len(cw)) if cw else 0
        score = max(score1, score2)
        if score > best_score:
            best_score = score
            best_id = cid
            
    return text, best_id, best_score

cards_saved = set()

# 1. Process ARTE2.PNG
img2 = cv2.imread('c:/dbtcg/arte2.png')

# Leaders (Row 1 & 2)
x_start_l = 108
leader_w = 193.3
for r_idx, y_base in [(1, 215), (2, 440)]:
    for c_idx in range(6):
        x1 = int(x_start_l + c_idx * leader_w)
        crop = find_exact_card_in_region(img2, (x1, y_base, int(leader_w), 225))
        text, cid, score = read_title(crop)
        if cid and score > 0.30:
            target_dir = 'assets/leaders' if 'awk' in cid or cid in leaders else 'assets/cards'
            cv2.imwrite(f'c:/dbtcg/{target_dir}/{cid}.png', crop)
            cards_saved.add(cid)
            print(f"arte2 [Leader/Awk] => '{text}' -> SAVED AS {cid}.png ({score:.2f})")

# Action (Row 3 & 4)
col_w2 = 146.25
x_start_c = 108
for r_idx, y_base in [(3, 680), (4, 880)]:
    for c_idx in range(8):
        x1 = int(x_start_c + c_idx * col_w2)
        crop = find_exact_card_in_region(img2, (x1, y_base, int(col_w2), 195))
        text, cid, score = read_title(crop)
        if cid and score > 0.30:
            cv2.imwrite(f'c:/dbtcg/assets/cards/{cid}.png', crop)
            cards_saved.add(cid)
            print(f"arte2 [Action] => '{text}' -> SAVED AS {cid}.png ({score:.2f})")

# 2. Process ARTE22.PNG & ARTE222.PNG
x_row12 = [118, 257, 397, 536, 677, 818]
w_row12 = 116

x_row34 = [88, 199, 311, 422, 534, 643, 752]
w_row34 = 102

rows = [
    (160, 168, x_row12, w_row12),
    (335, 168, x_row12, w_row12),
    (505, 150, x_row34, w_row34),
    (660, 150, x_row34, w_row34)
]

for tag in ['arte22', 'arte222']:
    img = cv2.imread(f'c:/dbtcg/{tag}.png')
    for y_pos, h_box, x_list, w_box in rows:
        for x_pos in x_list:
            crop = find_exact_card_in_region(img, (x_pos, y_pos, w_box, h_box))
            text, cid, score = read_title(crop)
            if cid and score > 0.30:
                target_dir = 'assets/leaders' if 'awk' in cid or cid in leaders else 'assets/cards'
                cv2.imwrite(f'c:/dbtcg/{target_dir}/{cid}.png', crop)
                cards_saved.add(cid)
                print(f"{tag} => '{text}' -> SAVED AS {cid}.png ({score:.2f})")

print(f"\nTOTAL UNIQUE CARDS SAVED DIRECTLY BY OCR VISION: {len(cards_saved)} / 82")
