import os
from PIL import Image

os.makedirs("assets/spritesheets/characters", exist_ok=True)
os.makedirs("assets/spritesheets/fx", exist_ok=True)

# 1. Process Goku LSW Sheet (98136.png)
goku_sheet_path = "assets/spritesheets/lsw/goku_sheet_98136.png"
if os.path.exists(goku_sheet_path):
    sheet = Image.open(goku_sheet_path).convert("RGBA")
    print(f"Loaded Goku LSW Sheet: {sheet.size}")

    # Extract Idle Stance Sprites (Top Left of sheet: Row 1)
    # LSW sprites are roughly 32x32 to 48x48
    # Create uniform 64x64 grid for game engine
    FRAME_SIZE = 64
    
    # 4 frames of Goku Base Idle
    idle_boxes = [
        (46, 56, 76, 96),
        (80, 56, 110, 96),
        (114, 56, 144, 96),
        (148, 56, 178, 96),
    ]
    
    # Extract Kamehameha Beam Charging & Firing Sprites from Row 12 (SSJ Kamehameha)
    kame_boxes = [
        (46, 570, 80, 610),
        (84, 570, 120, 610),
        (124, 570, 160, 610),
        (164, 570, 205, 610),
        (210, 570, 260, 610),
        (265, 550, 480, 630), # Full Beam Wave
    ]

    # Create Goku Clean 2D Game Sprite Sheet
    goku_game_sheet = Image.new("RGBA", (12 * FRAME_SIZE, FRAME_SIZE), (0, 0, 0, 0))
    for idx, box in enumerate(idle_boxes):
        sprite = sheet.crop(box)
        sw, sh = sprite.size
        # Paste in center of frame
        goku_game_sheet.paste(sprite, (idx * FRAME_SIZE + (FRAME_SIZE - sw) // 2, (FRAME_SIZE - sh) // 2), sprite)

    # Repeat for animation loop fill
    for idx in range(4, 12):
        src_idx = idx % len(idle_boxes)
        box = idle_boxes[src_idx]
        sprite = sheet.crop(box)
        sw, sh = sprite.size
        goku_game_sheet.paste(sprite, (idx * FRAME_SIZE + (FRAME_SIZE - sw) // 2, (FRAME_SIZE - sh) // 2), sprite)

    goku_game_sheet.save("assets/spritesheets/characters/goku_sheet.png")
    print("Exported Goku LSW Game SpriteSheet -> assets/spritesheets/characters/goku_sheet.png")

    # Extract Authentic Kamehameha Beam Sheet
    kame_sheet = Image.new("RGBA", (len(kame_boxes) * 128, 128), (0, 0, 0, 0))
    for idx, box in enumerate(kame_boxes):
        sprite = sheet.crop(box)
        sw, sh = sprite.size
        kame_sheet.paste(sprite, (idx * 128 + (128 - sw) // 2, (128 - sh) // 2), sprite)
    kame_sheet.save("assets/spritesheets/fx/kamehameha_sheet.png")
    print("Exported Authentic Kamehameha Beam Sheet -> assets/spritesheets/fx/kamehameha_sheet.png")

# 2. Process Vegeta LSW Sheet (vegeta_156224.png)
vegeta_sheet_path = "assets/spritesheets/lsw/vegeta_156224.png"
if os.path.exists(vegeta_sheet_path):
    vsheet = Image.open(vegeta_sheet_path).convert("RGBA")
    vw, vh = vsheet.size
    print(f"Loaded Vegeta LSW Sheet: {vsheet.size}")

    # Extract 4 frames of Vegeta Idle Stance
    v_game_sheet = Image.new("RGBA", (12 * 64, 64), (0, 0, 0, 0))
    # Slice first row sprites
    frame_w = max(24, vw // 8)
    frame_h = max(32, vh // 4)
    for idx in range(12):
        col = idx % 4
        x1 = col * frame_w
        y1 = 0
        x2 = min(vw, x1 + frame_w)
        y2 = min(vh, y1 + frame_h)
        sprite = vsheet.crop((x1, y1, x2, y2))
        sw, sh = sprite.size
        v_game_sheet.paste(sprite, (idx * 64 + (64 - sw) // 2, (64 - sh) // 2), sprite)
        
    v_game_sheet.save("assets/spritesheets/characters/vegeta_sheet.png")
    print("Exported Vegeta LSW Game SpriteSheet -> assets/spritesheets/characters/vegeta_sheet.png")

# 3. Process Gohan, Frieza, Piccolo, Trunks
for char in ["gohan", "frieza", "piccolo", "trunks"]:
    path = f"assets/spritesheets/lsw/{char}_sheet.png"
    if os.path.exists(path):
        csheet = Image.open(path).convert("RGBA")
        cw, ch = csheet.size
        c_game_sheet = Image.new("RGBA", (12 * 64, 64), (0, 0, 0, 0))
        frame_w = max(24, cw // 8)
        frame_h = max(32, ch // 4)
        for idx in range(12):
            col = idx % 4
            x1 = col * frame_w
            y1 = 0
            x2 = min(cw, x1 + frame_w)
            y2 = min(ch, y1 + frame_h)
            sprite = csheet.crop((x1, y1, x2, y2))
            sw, sh = sprite.size
            c_game_sheet.paste(sprite, (idx * 64 + (64 - sw) // 2, (64 - sh) // 2), sprite)
        c_game_sheet.save(f"assets/spritesheets/characters/{char}_sheet.png")
        print(f"Exported {char.capitalize()} LSW Game SpriteSheet -> assets/spritesheets/characters/{char}_sheet.png")

print("All Authentic LSW Sprite Sheets Sliced & Exported!")
