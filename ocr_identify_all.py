import cv2
import easyocr
import difflib
import re
import os
import json
import warnings
warnings.filterwarnings('ignore', category=UserWarning)

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

def read_title(cell):
    h, w = cell.shape[:2]
    top = cell[0:int(h*0.35), :]
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

# Helper to crop non-black inner card
def get_card_crop(cell):
    gray = cv2.cvtColor(cell, cv2.COLOR_BGR2GRAY)
    _, thresh = cv2.threshold(gray, 25, 255, cv2.THRESH_BINARY)
    contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if contours:
        c = max(contours, key=cv2.contourArea)
        cx, cy, cw, ch = cv2.boundingRect(c)
        if cw > 40 and ch > 60:
            return cell[cy:cy+ch, cx:cx+cw]
    return cell

results_map = {}

# 1. Process arte2.png
img2 = cv2.imread('c:/dbtcg/arte2.png')

# Leaders Row 1 & 2
x_start_l = 108
leader_w = 193.3
for row_idx, y_base in [(1, 215), (2, 440)]:
    for col_idx in range(6):
        x1 = int(x_start_l + col_idx * leader_w)
        crop = get_card_crop(img2[y_base:y_base+225, x1:x1+int(leader_w)])
        raw_text, match_id, score = read_title(crop)
        key = f"arte2_r{row_idx}_c{col_idx+1}"
        results_map[key] = {'raw': raw_text, 'match': match_id, 'score': score}
        print(f"{key} -> OCR: '{raw_text}' => MATCH: {match_id} ({score:.2f})")

# Action Row 3 & 4
col_w2 = 146.25
x_start_c = 108
for row_idx, y_base in [(3, 680), (4, 880)]:
    for col_idx in range(8):
        x1 = int(x_start_c + col_idx * col_w2)
        crop = get_card_crop(img2[y_base:y_base+195, x1:x1+int(col_w2)])
        raw_text, match_id, score = read_title(crop)
        key = f"arte2_r{row_idx}_c{col_idx+1}"
        results_map[key] = {'raw': raw_text, 'match': match_id, 'score': score}
        print(f"{key} -> OCR: '{raw_text}' => MATCH: {match_id} ({score:.2f})")

# 2. Process arte22.png & arte222.png
y_ranges = [(160, 168), (335, 168), (505, 150), (665, 145)]
x_ranges = [(5, 110), (118, 116), (256, 116), (396, 116), (537, 116), (678, 116), (818, 116)]

for fname in ['arte22.png', 'arte222.png']:
    img = cv2.imread(f'c:/dbtcg/{fname}')
    tag = fname.split('.')[0]
    for r_idx, (y_pos, h_box) in enumerate(y_ranges):
        for c_idx, (x_pos, w_box) in enumerate(x_ranges):
            cell = img[y_pos:y_pos+h_box, x_pos:x_pos+w_box]
            crop = get_card_crop(cell)
            raw_text, match_id, score = read_title(crop)
            key = f"{tag}_r{r_idx+1}_c{c_idx+1}"
            results_map[key] = {'raw': raw_text, 'match': match_id, 'score': score}
            print(f"{key} -> OCR: '{raw_text}' => MATCH: {match_id} ({score:.2f})")

with open('c:/dbtcg/ocr_results.json', 'w', encoding='utf-8') as f:
    json.dump(results_map, f, indent=2)
print("Saved all OCR identifications to ocr_results.json")
