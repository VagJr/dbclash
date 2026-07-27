import cv2
import os
import glob
import easyocr
import re
import difflib

# Load card DB
with open('c:/dbtcg/js/card-database.js', 'r', encoding='utf-8') as f:
    content = f.read()
    
# Extract all cards
matches = re.findall(r"id:\s*'([^']+)',\s*name:\s*'([^']+)'", content)
db_cards = {m[0]: m[1] for m in matches}

import warnings
warnings.filterwarnings('ignore', category=UserWarning)

reader = easyocr.Reader(['en', 'pt'], gpu=False, verbose=False)

for path in sorted(glob.glob('c:/dbtcg/assets/cards_tmp/*.png')):
    img = cv2.imread(path)
    if img is None: continue
    
    # Text is usually in the top 30% of the card
    h, w, _ = img.shape
    top_part = img[0:int(h*0.3), 0:w]
    
    # Preprocess for better OCR
    top_part = cv2.resize(top_part, None, fx=2, fy=2, interpolation=cv2.INTER_CUBIC)
    
    results = reader.readtext(top_part)
    text = ' '.join([res[1] for res in results])
    
    # Find best match
    best_match = None
    best_score = 0
    if text.strip():
        for cid, cname in db_cards.items():
            score = difflib.SequenceMatcher(None, text.lower(), cname.lower()).ratio()
            # Try matching individual words too
            text_words = set(text.lower().split())
            cname_words = set(cname.lower().split())
            common = text_words.intersection(cname_words)
            word_score = len(common) / max(1, len(cname_words))
            
            final_score = max(score, word_score)
            if final_score > best_score:
                best_score = final_score
                best_match = (cid, cname)
                
    print(f'{os.path.basename(path)} -> OCR: "{text}" | BEST: {best_match} (score {best_score:.2f})')
