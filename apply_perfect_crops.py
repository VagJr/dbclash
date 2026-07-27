import cv2
import os
import json

os.makedirs('c:/dbtcg/assets/leaders', exist_ok=True)
os.makedirs('c:/dbtcg/assets/cards', exist_ok=True)

# Helper to crop non-black inner card from region
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

# 1. ARTE2.PNG (1370x1148)
img2 = cv2.imread('c:/dbtcg/arte2.png')

# Leaders Row 1 (Base)
leaders_base = ['goku', 'vegeta', 'gohan', 'frieza', 'piccolo', 'trunks']
x_start_l = 108
leader_w = 193.3
for i, name in enumerate(leaders_base):
    x1 = int(x_start_l + i * leader_w)
    crop = find_exact_card_in_region(img2, (x1, 215, int(leader_w), 225))
    cv2.imwrite(f'c:/dbtcg/assets/leaders/{name}.png', crop)
    print(f'Leader: {name}.png ({crop.shape[1]}x{crop.shape[0]})')

# Leaders Row 2 (Awakened)
leaders_awk = ['goku_awk', 'vegeta_awk', 'gohan_awk', 'frieza_awk', 'piccolo_awk', 'trunks_awk']
for i, name in enumerate(leaders_awk):
    x1 = int(x_start_l + i * leader_w)
    crop = find_exact_card_in_region(img2, (x1, 440, int(leader_w), 225))
    cv2.imwrite(f'c:/dbtcg/assets/leaders/{name}.png', crop)
    print(f'Awk Leader: {name}.png ({crop.shape[1]}x{crop.shape[0]})')

# Action Row 3 in arte2.png
row3_arte2 = ['atk_01', 'atk_02', 'atk_03', 'atk_04', 'def_01', 'def_02', 'evd_01', 'evd_02']
col_w2 = 146.25
x_start_c = 108
for i, name in enumerate(row3_arte2):
    x1 = int(x_start_c + i * col_w2)
    crop = find_exact_card_in_region(img2, (x1, 680, int(col_w2), 195))
    cv2.imwrite(f'c:/dbtcg/assets/cards/{name}.png', crop)
    print(f'Arte2 Card: {name}.png ({crop.shape[1]}x{crop.shape[0]})')

# Action Row 4 in arte2.png
row4_arte2 = ['atk_05', 'atk_06', 'atk_07', 'atk_08', 'atk_09', 'atk_10', 'atk_11', 'tch_03']
for i, name in enumerate(row4_arte2):
    x1 = int(x_start_c + i * col_w2)
    crop = find_exact_card_in_region(img2, (x1, 880, int(col_w2), 195))
    cv2.imwrite(f'c:/dbtcg/assets/cards/{name}.png', crop)
    print(f'Arte2 Card: {name}.png ({crop.shape[1]}x{crop.shape[0]})')


# 2. ARTE22.PNG (1024x858)
# Cols 2..7 (6 cards per row, skip col 1 which is empty)
img22 = cv2.imread('c:/dbtcg/arte22.png')

y_ranges_22 = [(160, 168), (335, 168), (505, 150), (665, 145)]
x_cols_22 = [118, 256, 396, 537, 678, 818] # 6 cols (Cols 2..7)
w_box_22 = 116

arte22_grid = [
    # Row 1 (y=160)
    ['atk_28', 'def_01', 'def_02', 'def_03', 'def_04', 'def_05'],
    # Row 2 (y=335)
    ['def_06', 'def_07', 'def_08', 'def_09', 'def_10', 'def_11'],
    # Row 3 (y=505)
    ['def_12', 'def_13', 'def_14', 'def_15', 'evd_01', 'evd_02'],
    # Row 4 (y=665)
    ['evd_03', 'evd_04', 'evd_05', 'evd_06', 'evd_07', 'evd_08', 'evd_09']
]

for r_idx, (y_pos, h_box) in enumerate(y_ranges_22):
    row_names = arte22_grid[r_idx]
    for c_idx, x_pos in enumerate(x_cols_22):
        if c_idx >= len(row_names): break
        name = row_names[c_idx]
        crop = find_exact_card_in_region(img22, (x_pos, y_pos, w_box_22, h_box), thresh_val=25)
        cv2.imwrite(f'c:/dbtcg/assets/cards/{name}.png', crop)
        print(f'Arte22 Card: {name}.png ({crop.shape[1]}x{crop.shape[0]})')


# 3. ARTE222.PNG (1024x858)
# Cols 2..7 (6 cards per row, skip col 1 which is empty)
img222 = cv2.imread('c:/dbtcg/arte222.png')

arte222_grid = [
    # Row 1 (y=160)
    ['ctr_01', 'ctr_02', 'ctr_03', 'ctr_04', 'ctr_05', 'ctr_06'],
    # Row 2 (y=335)
    ['ctr_07', 'ctr_08', 'ctr_09', 'tch_01', 'tch_02', 'tch_03'],
    # Row 3 (y=505)
    ['tch_04', 'tch_05', 'tch_06', 'tch_07', 'tch_08', 'tch_09'],
    # Row 4 (y=665)
    ['atk_12', 'atk_13', 'atk_14', 'atk_15', 'atk_16', 'atk_17', 'atk_18', 'atk_19', 'atk_20', 'atk_21', 'atk_22', 'atk_23', 'atk_24', 'atk_25', 'atk_26', 'atk_27']
]

for r_idx, (y_pos, h_box) in enumerate(y_ranges_22):
    row_names = arte222_grid[r_idx]
    for c_idx, x_pos in enumerate(x_cols_22):
        if c_idx >= len(row_names): break
        name = row_names[c_idx]
        crop = find_exact_card_in_region(img222, (x_pos, y_pos, w_box_22, h_box), thresh_val=25)
        cv2.imwrite(f'c:/dbtcg/assets/cards/{name}.png', crop)
        print(f'Arte222 Card: {name}.png ({crop.shape[1]}x{crop.shape[0]})')

print("Applied perfect OCR-matched card crops successfully!")
