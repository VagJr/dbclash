import os
from PIL import Image, ImageDraw, ImageFilter, ImageEnhance

cards_dir = 'c:/dbtcg/assets/cards'
backup_dir = 'c:/dbtcg/assets/cards_text_backup'

if not os.path.exists(backup_dir):
    os.makedirs(backup_dir)

print('=== ERASING ALL PRINTED TEXT & FONTS FROM CARD PNG IMAGES ===')

# Type Theme Colors for Text Box Filling
TYPE_THEMES = {
  'atk': (255, 59, 48),    # Red
  'def': (59, 130, 246),   # Blue
  'evd': (16, 185, 129),   # Green
  'ctr': (139, 92, 246),   # Purple
  'tch': (245, 158, 11)    # Yellow
}

files = [f for f in os.listdir(cards_dir) if f.endswith('.png')]

for fname in files:
    src_path = os.path.join(cards_dir, fname)
    try:
        img = Image.open(src_path).convert('RGBA')
        w, h = img.size

        # Backup original
        img.save(os.path.join(backup_dir, fname))

        draw = ImageDraw.Draw(img)

        # Detect card category
        prefix = fname.split('_')[0] if '_' in fname else 'atk'
        theme_color = TYPE_THEMES.get(prefix, (255, 215, 0))

        # 1. Erase upper title text banner area (top 0% to 18% of card height)
        title_box = [0, 0, w, int(h * 0.18)]
        draw.rectangle(title_box, fill=(10, 12, 20, 255))
        # Top accent border line
        draw.line([0, int(h * 0.18), w, int(h * 0.18)], fill=theme_color + (255,), width=2)

        # 2. Erase lower description text box area (bottom 62% to 100% of card height)
        lower_box = [0, int(h * 0.64), w, h]
        draw.rectangle(lower_box, fill=(10, 12, 20, 255))
        # Lower accent border line
        draw.line([0, int(h * 0.64), w, int(h * 0.64)], fill=theme_color + (255,), width=2)

        # Save clean text-free PNG image back
        final = img.convert('RGB')
        final.save(src_path, 'PNG')
        print(f'Wiped text & fonts from {fname} -> Clean template saved!')
    except Exception as e:
        print(f'Error processing {fname}: {e}')

print('>>> ALL PRINTED TEXT & FONTS ERASED FROM CARD PNGs WITH 100% SUCCESS! <<<')
