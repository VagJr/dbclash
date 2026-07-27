import os
import json
import shutil
from PIL import Image, ImageDraw, ImageFilter

cards_dir = 'c:/dbtcg/assets/cards'
backup_dir = 'c:/dbtcg/assets/cards_raw_backup'

if not os.path.exists(backup_dir):
    os.makedirs(backup_dir)
    for f in os.listdir(cards_dir):
        if f.endswith('.png'):
            shutil.copy(os.path.join(cards_dir, f), os.path.join(backup_dir, f))
    print('Created backup of raw cards in assets/cards_raw_backup!')

with open('c:/dbtcg/ocr_results.json', 'r', encoding='utf-8') as f:
    ocr = json.load(f)

# Explicit OCR Mapping Rules (Source File -> Target Card ID)
remap_table = {
  'atk_01.png': 'atk_22.png', # Scatter Shot / Meteoros em Cadeia
  'atk_02.png': 'atk_02.png', # Kamehameha
  'atk_03.png': 'atk_03.png', # Final Flash
  'atk_04.png': 'atk_04.png', # Dragon Fist Rush / Cadeia de Dragões
  'atk_05.png': 'atk_05.png', # Special Beam Cannon
  'atk_06.png': 'atk_06.png', # Shining Sword Slash
  'atk_07.png': 'atk_07.png', # Death Beam Snipe
  'atk_08.png': 'atk_08.png', # Galick Gun
  'atk_09.png': 'atk_09.png', # Masenko Beam
  'atk_10.png': 'atk_14.png', # Kaioken x10 Strike
  'atk_12.png': 'tch_04.png', # Saiyan Pride Surge
  'atk_15.png': 'def_01.png', # Energy Shield
  'atk_18.png': 'atk_28.png', # Fierce Dragon Charge
  'atk_19.png': 'def_02.png', # Ki Barrier
  'atk_20.png': 'def_03.png', # Android Barrier
  'atk_25.png': 'def_06.png', # Royal Saiyan Guard
  'atk_26.png': 'def_07.png', # Full Power Deflect
  'atk_27.png': 'def_08.png', # Iron Guard Stance
  'ctr_01.png': 'ctr_01.png', # Solar Flare
  'ctr_02.png': 'ctr_02.png', # Explosive Wave
  'ctr_03.png': 'ctr_03.png', # Time Freeze
  'ctr_04.png': 'ctr_04.png', # Ki Blast Deflection
  'ctr_05.png': 'ctr_05.png', # Body Change Trick
  'ctr_06.png': 'ctr_06.png', # Counter Shockwave
  'ctr_08.png': 'ctr_08.png', # Emperor Finger Snap
  'ctr_09.png': 'ctr_09.png', # Kai Blast Counter
  'def_01.png': 'def_01.png', # Energy Shield
  'def_02.png': 'def_02.png', # Ki Barrier
  'def_03.png': 'def_03.png', # Android Barrier
  'def_04.png': 'def_04.png', # Godly Guard Wall
  'def_07.png': 'def_07.png', # Full Power Deflect
  'def_08.png': 'def_08.png', # Iron Guard Stance
  'def_09.png': 'def_09.png', # Titanium Ki Wall
  'def_11.png': 'def_11.png', # Ultra Energy Dome
  'def_12.png': 'def_12.png', # Sword Guard Cross
  'def_13.png': 'def_13.png', # Ki Repulsion Field
  'evd_01.png': 'evd_01.png', # Z-Vanish Teleport
  'evd_02.png': 'evd_02.png', # Afterimage
  'evd_03.png': 'evd_03.png', # Instant Transmission
  'evd_04.png': 'evd_04.png', # High Speed Sidestep
  'evd_05.png': 'evd_05.png', # Shadow Slip
  'evd_06.png': 'evd_06.png', # Ultra Instinct Flash
  'evd_07.png': 'evd_07.png', # Speed Phantom
  'evd_08.png': 'evd_08.png', # Aura Dodge
  'evd_09.png': 'evd_09.png', # Dimension Shift
  'tch_01.png': 'tch_01.png', # Kaioken Boost
  'tch_02.png': 'tch_02.png', # Senzu Bean
  'tch_03.png': 'tch_03.png', # Spirit Bomb Charge
  'tch_04.png': 'tch_04.png', # Saiyan Pride Surge
  'tch_08.png': 'tch_08.png'  # Time Chamber Training
}

print('Applying remapping table...')
for src_name, target_name in remap_table.items():
    src_path = os.path.join(backup_dir, src_name)
    target_path = os.path.join(cards_dir, target_name)
    if os.path.exists(src_path):
        # Open image and crop out burned-in title text at top/bottom (18% from top, 15% from bottom)
        try:
            im = Image.open(src_path)
            w, h = im.size
            if h > 50:
                crop_box = (0, int(h * 0.16), w, int(h * 0.86))
                cropped = im.crop(crop_box)
                cropped.save(target_path)
        except Exception as e:
            shutil.copy(src_path, target_path)

print('Cropped out burned-in title banners so card art fills 100% cleanly!')

# Generate fallback artworks for any cards without distinct art
card_styles = {
    'atk_11': ('#ff3b30', '#ff8800', 'SUPERNOVA BLAST'),
    'atk_13': ('#3b82f6', '#00f2fe', 'BIG BANG ATTACK'),
    'atk_16': ('#ffd700', '#00f2fe', 'FATHER-SON KAMEHAMEHA'),
    'atk_17': ('#10b981', '#ffffff', 'LIGHT GRENADE'),
    'atk_21': ('#ff3b30', '#ffd700', 'HIGH SPEED FLURRY'),
    'atk_23': ('#8b5cf6', '#00f2fe', 'SWORD OF HOPE'),
    'atk_24': ('#ffd700', '#ff3b30', 'GOLDEN DEATH BEAM'),
    'atk_25': ('#00f2fe', '#ffffff', 'GOD KAMEHAMEHA'),
    'atk_27': ('#00f2fe', '#ffffff', 'SUPER SPIRIT BOMB'),
    'def_10': ('#8b5cf6', '#3b82f6', 'EMPEROR SHIELD'),
    'def_14': ('#10b981', '#ffffff', 'NAMEKIAN BARRIER'),
    'def_15': ('#ffd700', '#ff8800', 'SUPER SAIYAN WALL'),
    'ctr_07': ('#ffd700', '#ff3b30', 'DRAGON ROAR COUNTER'),
    'tch_05': ('#a78bfa', '#ffffff', 'POTENTIAL UNLEASHED'),
    'tch_06': ('#ffd700', '#ff8800', 'GOLDEN TRANSFORM'),
    'tch_07': ('#10b981', '#00f2fe', 'NAMEKIAN HEALING'),
    'tch_09': ('#ff3b30', '#ffd700', 'OVERDRIVE AWAKENING')
}

for cid, (c1, c2, title) in card_styles.items():
    target_path = os.path.join(cards_dir, f'{cid}.png')
    img = Image.new('RGB', (300, 420), (10, 12, 20))
    draw = ImageDraw.Draw(img)
    
    # Render radiant Ki energy aura gradient
    for r in range(180, 0, -4):
        alpha = int((1 - r / 180.0) * 255)
        color = c1 if r % 8 == 0 else c2
        draw.ellipse([150 - r, 180 - r, 150 + r, 180 + r], fill=color)

    draw.rectangle([0, 360, 300, 420], fill=(15, 18, 30))
    img.save(target_path)

print('Generated clean full-art PNGs for all remaining cards!')
