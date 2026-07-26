import cv2
import os

os.makedirs('c:/dbtcg/assets/leaders', exist_ok=True)
os.makedirs('c:/dbtcg/assets/cards', exist_ok=True)

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

img2 = cv2.imread('c:/dbtcg/arte2.png')
img22 = cv2.imread('c:/dbtcg/arte22.png')
img222 = cv2.imread('c:/dbtcg/arte222.png')

# 1. FIX FINAL FLASH (atk_03) & DEATH BEAM SNIPE (atk_07) TOP MARGIN (y=688 & y=888)
col_w2 = 146.25
x_start_c = 108

# atk_03 is Col 3 in Row 3 (i=2)
x_atk03 = int(x_start_c + 2 * col_w2)
crop_atk03 = find_exact_card_in_region(img2, (x_atk03 + 2, 688, int(col_w2) - 4, 188))
cv2.imwrite('c:/dbtcg/assets/cards/atk_03.png', crop_atk03)
print(f'Fixed atk_03 (Final Flash): {crop_atk03.shape[1]}x{crop_atk03.shape[0]}')

# atk_07 is Col 3 in Row 4 (i=2)
x_atk07 = int(x_start_c + 2 * col_w2)
crop_atk07 = find_exact_card_in_region(img2, (x_atk07 + 2, 888, int(col_w2) - 4, 188))
cv2.imwrite('c:/dbtcg/assets/cards/atk_07.png', crop_atk07)
print(f'Fixed atk_07 (Death Beam Snipe): {crop_atk07.shape[1]}x{crop_atk07.shape[0]}')

# 2. FIX DIMENSION SHIFT (evd_09) in arte22 Row 4 Col 7 (x=752, y=660)
crop_evd09 = find_exact_card_in_region(img22, (752, 660, 102, 145))
cv2.imwrite('c:/dbtcg/assets/cards/evd_09.png', crop_evd09)
print(f'Fixed evd_09 (Dimension Shift): {crop_evd09.shape[1]}x{crop_evd09.shape[0]}')

# 3. FIX HELLZONE GRENADE (atk_12) & BIG BANG ATTACK (atk_13)
# atk_12 is arte222 Row 4 Col 1 (x=88, y=660)
crop_atk12 = find_exact_card_in_region(img222, (88, 660, 102, 145))
cv2.imwrite('c:/dbtcg/assets/cards/atk_12.png', crop_atk12)
print(f'Fixed atk_12 (Hellzone Grenade): {crop_atk12.shape[1]}x{crop_atk12.shape[0]}')

# atk_13 is arte222 Row 4 Col 2 (x=199, y=660)
crop_atk13 = find_exact_card_in_region(img222, (199, 660, 102, 145))
cv2.imwrite('c:/dbtcg/assets/cards/atk_13.png', crop_atk13)
print(f'Fixed atk_13 (Big Bang Attack): {crop_atk13.shape[1]}x{crop_atk13.shape[0]}')

# 4. FIX GOLDEN DEATH BEAM (atk_20 / atk_24)
# atk_20 in arte22 Row 1 Col 4 (x=536, y=160)
crop_atk20 = find_exact_card_in_region(img22, (536, 160, 116, 168))
cv2.imwrite('c:/dbtcg/assets/cards/atk_20.png', crop_atk20)
print(f'Fixed atk_20 (Golden Death Beam): {crop_atk20.shape[1]}x{crop_atk20.shape[0]}')

print("All specific card fixes applied successfully!")
