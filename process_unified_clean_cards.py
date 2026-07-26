import os
import shutil
from PIL import Image

backup_dir = 'c:/dbtcg/assets/cards_raw_backup'
cards_dir = 'c:/dbtcg/assets/cards'
leaders_dir = 'c:/dbtcg/assets/leaders'

print('=== RESTORING RAW CLEAN CARD PNGs WITHOUT DRAWN BORDERS ===')

if os.path.exists(backup_dir):
    for f in os.listdir(backup_dir):
        if f.endswith('.png'):
            shutil.copy(os.path.join(backup_dir, f), os.path.join(cards_dir, f))
    print('Restored clean card images from backup to assets/cards/')

# Copy generated kamehameha image for atk_02
kamehameha_generated = 'C:/Users/vagmi/.gemini/antigravity-ide/brain/07a7fd72-44dd-4117-9527-46683382e456/kamehameha_card_art_1785053524999.png'
if os.path.exists(kamehameha_generated):
    shutil.copy(kamehameha_generated, os.path.join(cards_dir, 'atk_02.png'))
    print('Updated atk_02.png (Kamehameha) with latest high-res AI generated card art!')

# Ensure leader portraits are clean without outer drawn borders
scratch_dir = 'C:/Users/vagmi/.gemini/antigravity-ide/brain/07a7fd72-44dd-4117-9527-46683382e456/scratch/test_arte33'
leaders = ['goku', 'vegeta', 'gohan', 'frieza', 'piccolo', 'trunks']

for l in leaders:
    base_src = os.path.join(scratch_dir, f'{l}.png')
    awk_src = os.path.join(scratch_dir, f'{l}_awaken.png')
    
    if os.path.exists(base_src):
        shutil.copy(base_src, os.path.join(leaders_dir, f'{l}.png'))
    if os.path.exists(awk_src):
        shutil.copy(awk_src, os.path.join(leaders_dir, f'{l}_awk.png'))

print('>>> ALL CARD PNGs & LEADERS RESTORED CLEAN WITHOUT DRAWN OUTER BORDERS! <<<')
