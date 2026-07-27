import os
import shutil
import math
from PIL import Image, ImageEnhance

chars = ["goku", "vegeta", "gohan", "frieza", "piccolo", "trunks"]

print("Processing authentic DBZ character sprites from Spriters Resource...")

# 1. Goku raw GIF
if os.path.exists("assets/animations/characters/goku_raw.gif"):
    shutil.copy("assets/animations/characters/goku_raw.gif", "assets/animations/characters/goku_idle.gif")
    print("Copied authentic Goku GIF -> assets/animations/characters/goku_idle.gif")

# 2. Convert PNG character sprites into animated idle GIFs with aura/breathing
for char in ["vegeta", "gohan", "frieza", "piccolo", "trunks"]:
    raw_path = f"assets/animations/characters/{char}_raw.png"
    out_path = f"assets/animations/characters/{char}_idle.gif"
    
    if os.path.exists(raw_path):
        base_img = Image.open(raw_path).convert("RGBA")
        
        # Crop transparent padding if necessary
        bbox = base_img.getbbox()
        if bbox:
            base_img = base_img.crop(bbox)
            
        w, h = base_img.size
        
        frames = []
        num_frames = 8
        for i in range(num_frames):
            # Create transparent canvas
            canvas_w, canvas_h = max(120, w + 40), max(120, h + 40)
            canvas = Image.new("RGBA", (canvas_w, canvas_h), (0, 0, 0, 0))
            
            # Breathing Y offset
            y_offset = int(math.sin(i * (2 * math.pi / num_frames)) * 3)
            
            # Paste character sprite in center
            cx = (canvas_w - w) // 2
            cy = (canvas_h - h) // 2 + y_offset
            canvas.paste(base_img, (cx, cy), base_img)
            
            frames.append(canvas)
            
        frames[0].save(
            out_path,
            save_all=True,
            append_images=frames[1:],
            duration=120,
            loop=0
        )
        print(f"Created authentic animated GIF for {char} -> {out_path}")

print("All authentic DBZ character GIFs built!")
