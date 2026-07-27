import json
import os
import re

with open('c:/dbtcg/ocr_results.json', 'r', encoding='utf-8') as f:
    ocr = json.load(f)

print('=== OCR SCAN RESULTS FOR ALL 82 CARDS ===')
for filename, text in sorted(ocr.items()):
    print(f'{filename}: {text}')
