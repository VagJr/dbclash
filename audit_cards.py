import cv2
import easyocr
import glob
import os
import difflib
import json
import re
import warnings
warnings.filterwarnings('ignore', category=UserWarning)

with open('c:/dbtcg/js/card-database.js', 'r', encoding='utf-8') as f:
    db_text = f.read()

matches = re.findall(r"id:\s*'([^']+)',\s*name:\s*'([^']+)'", db_text)
db_cards = {m[0]: m[1] for m in matches}

reader = easyocr.Reader(['en', 'pt'], gpu=False, verbose=False)

mismatches = []
successes = []

print('=== AUDITING ALL 70 ACTION CARDS IN ASSETS/CARDS/ ===')
for path in sorted(glob.glob('c:/dbtcg/assets/cards/*.png')):
    cid = os.path.basename(path).replace('.png', '')
    if cid not in db_cards: continue
    cname = db_cards[cid]
    
    img = cv2.imread(path)
    if img is None: continue
    h, w = img.shape[:2]
    
    # Read top area for title
    top = img[0:int(h*0.4), :]
    top_large = cv2.resize(top, (0,0), fx=2, fy=2, interpolation=cv2.INTER_CUBIC)
    
    results = reader.readtext(top_large)
    text = ' '.join([res[1] for res in results])
    
    score = difflib.SequenceMatcher(None, text.lower(), cname.lower()).ratio()
    tw = set(re.findall(r'\w+', text.lower()))
    cw = set(re.findall(r'\w+', cname.lower()))
    word_score = len(tw.intersection(cw)) / float(len(cw)) if cw else 0
    
    final_score = max(score, word_score)
    
    if final_score > 0.35:
        successes.append((cid, cname, text, final_score))
        print(f"  [OK] {cid} ({cname}) => OCR: '{text}' ({final_score:.2f})")
    else:
        mismatches.append((cid, cname, text, final_score))
        print(f"  [MISMATCH] {cid} (Expected: '{cname}') => OCR: '{text}' ({final_score:.2f})")

print(f"\nSUMMARY: {len(successes)} OK, {len(mismatches)} MISMATCHES.")
