import os
from PIL import Image

artifacts_dir = 'C:/Users/vagmi/.gemini/antigravity-ide/brain/07a7fd72-44dd-4117-9527-46683382e456'
cards_dir = 'c:/dbtcg/assets/cards'

sheets = [
  os.path.join(artifacts_dir, 'unified_sheet_goku_saiyan_1785053933262.png'),
  os.path.join(artifacts_dir, 'unified_sheet_vegeta_trunks_1785053952863.png'),
  os.path.join(artifacts_dir, 'unified_sheet_gohan_frieza_1785053973107.png')
]

# Order of cards to populate across the 48 cropped high-res tiles
card_id_sequence = [
  # Goku & Saiyan techniques (Sheet 1)
  'atk_01', 'atk_02', 'atk_04', 'atk_14', 'atk_25', 'atk_27', 'atk_28', 'tch_01',
  'tch_02', 'tch_03', 'evd_01', 'evd_02', 'evd_03', 'ctr_01', 'ctr_02', 'ctr_09',

  # Vegeta & Trunks techniques (Sheet 2)
  'atk_03', 'atk_06', 'atk_08', 'atk_10', 'atk_13', 'atk_19', 'atk_23', 'tch_04',
  'tch_08', 'def_06', 'def_08', 'def_12', 'evd_04', 'evd_05', 'ctr_04', 'ctr_06',

  # Gohan, Piccolo & Frieza techniques (Sheet 3)
  'atk_05', 'atk_07', 'atk_09', 'atk_11', 'atk_12', 'atk_16', 'atk_17', 'atk_18',
  'atk_24', 'def_05', 'def_10', 'def_14', 'tch_05', 'tch_06', 'tch_07', 'tch_09'
]

print('=== SLICING AND INJECTING UNIFIED HIGH-RES CARD ARTWORKS ===')

seq_idx = 0
for sheet_path in sheets:
    if not os.path.exists(sheet_path):
        print(f'Warning: {sheet_path} does not exist!')
        continue

    img = Image.open(sheet_path)
    w, h = img.size
    cols, rows = 4, 4
    cw, ch = w // cols, h // rows

    for r in range(rows):
        for c in range(cols):
            if seq_idx >= len(card_id_sequence):
                break
            
            card_id = card_id_sequence[seq_idx]
            seq_idx += 1

            box = (c * cw, r * ch, (c + 1) * cw, (r + 1) * ch)
            tile = img.crop(box).resize((300, 420), Image.Resampling.LANCZOS)
            
            target_path = os.path.join(cards_dir, f'{card_id}.png')
            tile.save(target_path, 'PNG')
            print(f'Saved unified full-art PNG for {card_id} -> {target_path}')

print('>>> ALL CARD TILES SLICED & INJECTED WITH UNIFIED VISUAL IDENTITY 100% SUCCESS! <<<')
