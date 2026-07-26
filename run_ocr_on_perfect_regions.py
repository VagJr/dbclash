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
    top = cell[0:int(h*0.4), :]
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

results = {}

# Layout specs
x_row12 = [118, 257, 397, 536, 677, 818]
w_row12 = 116

x_row34 = [88, 199, 311, 422, 534, 643, 752]
w_row34 = 102

rows = [
    ('Row 1', 160, 168, x_row12, w_row12),
    ('Row 2', 335, 168, x_row12, w_row12),
    ('Row 3', 505, 150, x_row34, w_row34),
    ('Row 4', 660, 150, x_row34, w_row34)
]

for tag in ['arte22', 'arte222']:
    img = cv2.imread(f'c:/dbtcg/{tag}.png')
    for rname, y_pos, h_box, x_list, w_box in rows:
        for idx, x_pos in enumerate(x_list):
            crop = find_exact_card_in_region(img, (x_pos, y_pos, w_box, h_box))
            raw_text, match_id, score = read_title(crop)
            key = f"{tag}_{rname.replace(' ', '')}_c{idx+1}"
            results[key] = {'raw': raw_text, 'match': match_id, 'score': float(score), 'box': [x_pos, y_pos, w_box, h_box]}
            print(f"{key} -> '{raw_text}' => MATCH: {match_id} ({score:.2f})")

with open('c:/dbtcg/perfect_ocr_results.json', 'w', encoding='utf-8') as f:
    json.dump(results, f, indent=2)
print("Saved perfect OCR results to perfect_ocr_results.json")
