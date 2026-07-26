import cv2
import numpy as np
import os

img = cv2.imread('c:/dbtcg/collection_sheet_1.png')
gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

# The background is mostly dark blue, the cards are bright
_, thresh = cv2.threshold(gray, 50, 255, cv2.THRESH_BINARY)

# Find contours
contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

# Filter for card-like rectangles
cards = []
for c in contours:
    x, y, w, h = cv2.boundingRect(c)
    area = w * h
    # A card is roughly (1024/4)*0.8 = 204 width, 250 height approx?
    if area > 10000 and area < 100000:
        if 0.6 < w/h < 0.9:
            cards.append((x, y, w, h))

# Sort by y (rows) then x (cols)
cards.sort(key=lambda b: (b[1]//100, b[0]))

print(f"Found {len(cards)} potential cards.")
for idx, (x, y, w, h) in enumerate(cards):
    print(f"Card {idx}: x={x}, y={y}, w={w}, h={h}")

# If we didn't find exactly 16, let's just print the 20 largest contours
if len(cards) != 16:
    print("\nFallback: Largest contours by area:")
    contours = sorted(contours, key=cv2.contourArea, reverse=True)[:20]
    for idx, c in enumerate(contours):
        x, y, w, h = cv2.boundingRect(c)
        print(f"Contour {idx}: area={w*h}, x={x}, y={y}, w={w}, h={h}")
