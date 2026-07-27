import os
from PIL import Image, ImageStat
import numpy as np

img = Image.open('c:/dbtcg/collection_sheet_1.png').convert('RGB')
sw, sh = img.size
tw, th = sw // 4, sh // 4

# Let's get the first tile
tile = img.crop((0, 0, tw, th))
tile.save('c:/dbtcg/tile_0_0.png')

# Convert tile to numpy array
arr = np.array(tile)

# We want to find the bounding box of the actual card.
# The card might have a specific background or border.
# Let's print out the row/col sums of differences from the background to see where the card starts.
# Assuming background is the corners.
bg_color = arr[0, 0]
diff = np.sum(np.abs(arr - bg_color), axis=2)

# Any pixel with difference > threshold is part of the card
mask = diff > 30

rows = np.any(mask, axis=1)
cols = np.any(mask, axis=0)

rmin, rmax = np.where(rows)[0][[0, -1]]
cmin, cmax = np.where(cols)[0][[0, -1]]

print(f"Tile Size: {tw}x{th}")
print(f"Card Bounding Box in Tile 0,0: x={cmin} to {cmax}, y={rmin} to {rmin}")
print(f"Card Width: {cmax - cmin + 1}")
print(f"Card Height: {rmax - rmin + 1}")

# Save the cropped tile to verify
cropped_card = tile.crop((cmin, rmin, cmax, rmax))
cropped_card.save('c:/dbtcg/test_card_crop.png')
print("Saved c:/dbtcg/test_card_crop.png")
