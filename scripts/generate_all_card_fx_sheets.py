import os
from PIL import Image, ImageDraw
import math

os.makedirs("assets/spritesheets/fx", exist_ok=True)

FRAME_SIZE = 64
TOTAL_FRAMES = 10

def create_fx_sheet(filename, draw_frame_func):
    sheet = Image.new("RGBA", (TOTAL_FRAMES * FRAME_SIZE, FRAME_SIZE), (0, 0, 0, 0))
    for i in range(TOTAL_FRAMES):
        frame = Image.new("RGBA", (FRAME_SIZE, FRAME_SIZE), (0, 0, 0, 0))
        t = i / (TOTAL_FRAMES - 1)
        draw_frame_func(frame, t, i)
        sheet.paste(frame, (i * FRAME_SIZE, 0))
    filepath = os.path.join("assets/spritesheets/fx", filename)
    sheet.save(filepath)
    print(f"Generated {filepath} ({os.path.getsize(filepath)} bytes)")

# 1. Galick Gun (Purple destructive wave)
def draw_galick_gun(frame, t, i):
    draw = ImageDraw.Draw(frame)
    cx, cy = 32, 32
    r = int(6 + t * 20)
    draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(168, 85, 247, 190))
    draw.ellipse([cx - r*0.6, cy - r*0.6, cx + r*0.6, cy + r*0.6], fill=(236, 72, 153, 230))
    draw.ellipse([cx - r*0.3, cy - r*0.3, cx + r*0.3, cy + r*0.3], fill=(255, 255, 255, 255))
create_fx_sheet("galick_gun_sheet.png", draw_galick_gun)

# 2. Kienzan (Destructo Disc spinning gold razor disc)
def draw_kienzan(frame, t, i):
    draw = ImageDraw.Draw(frame)
    cx, cy = 32, 32
    r = int(8 + t * 16)
    draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(255, 215, 0, 230))
    draw.ellipse([cx - r*0.8, cy - r*0.8, cx + r*0.8, cy + r*0.8], fill=(255, 255, 255, 255))
    # Razor teeth around disc
    for a in range(0, 360, 45):
        rad = math.radians(a + i * 40)
        x2 = cx + math.cos(rad) * (r + 4)
        y2 = cy + math.sin(rad) * (r + 4)
        draw.line([cx, cy, x2, y2], fill=(255, 255, 255, 255), width=2)
create_fx_sheet("kienzan_sheet.png", draw_kienzan)

# 3. Kikoho (Tri-Beam square shockwave pillar)
def draw_kikoho(frame, t, i):
    draw = ImageDraw.Draw(frame)
    cx, cy = 32, 32
    size = int(6 + t * 22)
    draw.rectangle([cx - size, cy - size, cx + size, cy + size], fill=(255, 215, 0, 180), outline=(255, 255, 255, 240), width=2)
    draw.rectangle([cx - size*0.5, cy - size*0.5, cx + size*0.5, cy + size*0.5], fill=(255, 255, 255, 255))
create_fx_sheet("kikoho_sheet.png", draw_kikoho)

# 4. Dragon Fist (Golden dragon aura surge)
def draw_dragon_fist(frame, t, i):
    draw = ImageDraw.Draw(frame)
    cx, cy = 32, 32
    r = int(10 + t * 18)
    draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(255, 140, 0, 200))
    draw.ellipse([cx - r*0.6, cy - r*0.6, cx + r*0.6, cy + r*0.6], fill=(255, 215, 0, 240))
    draw.ellipse([cx - r*0.2, cy - r*0.2, cx + r*0.2, cy + r*0.2], fill=(255, 255, 255, 255))
create_fx_sheet("dragon_fist_sheet.png", draw_dragon_fist)

# 5. Solar Flare (Blinding radial flash)
def draw_solar_flare(frame, t, i):
    draw = ImageDraw.Draw(frame)
    cx, cy = 32, 32
    r = int(12 + t * 20)
    draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(255, 255, 255, 255))
    for a in range(0, 360, 30):
        rad = math.radians(a)
        x2 = cx + math.cos(rad) * 32
        y2 = cy + math.sin(rad) * 32
        draw.line([cx, cy, x2, y2], fill=(255, 215, 0, 200), width=3)
create_fx_sheet("solar_flare_sheet.png", draw_solar_flare)

# 6. Spirit Sword (Golden blade slash)
def draw_spirit_sword(frame, t, i):
    draw = ImageDraw.Draw(frame)
    w = int(t * 64)
    draw.line([0, 64 - w, w, 0], fill=(255, 215, 0, 240), width=8)
    draw.line([0, 64 - w, w, 0], fill=(255, 255, 255, 255), width=3)
create_fx_sheet("spirit_sword_sheet.png", draw_spirit_sword)

# 7. Supernova (Giant planet-destroying sun sphere)
def draw_supernova(frame, t, i):
    draw = ImageDraw.Draw(frame)
    cx, cy = 32, 32
    r = int(10 + t * 22)
    draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(239, 68, 68, 200))
    draw.ellipse([cx - r*0.7, cy - r*0.7, cx + r*0.7, cy + r*0.7], fill=(255, 140, 0, 230))
    draw.ellipse([cx - r*0.3, cy - r*0.3, cx + r*0.3, cy + r*0.3], fill=(255, 255, 255, 255))
create_fx_sheet("supernova_sheet.png", draw_supernova)

# 8. Kaioken Strike (Flaming crimson kaioken aura)
def draw_kaioken_strike(frame, t, i):
    draw = ImageDraw.Draw(frame)
    cx, cy = 32, 32
    r = int(8 + t * 20)
    draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(239, 68, 68, 220))
    draw.ellipse([cx - r*0.5, cy - r*0.5, cx + r*0.5, cy + r*0.5], fill=(255, 255, 255, 255))
create_fx_sheet("kaioken_strike_sheet.png", draw_kaioken_strike)

# 9. Time Skip (Purple temporal distortion rings)
def draw_time_skip(frame, t, i):
    draw = ImageDraw.Draw(frame)
    cx, cy = 32, 32
    r = int(6 + t * 22)
    draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(0, 0, 0, 0), outline=(168, 85, 247, 240), width=3)
    draw.ellipse([cx - r*0.6, cy - r*0.6, cx + r*0.6, cy + r*0.6], fill=(0, 0, 0, 0), outline=(0, 242, 254, 240), width=2)
create_fx_sheet("time_skip_sheet.png", draw_time_skip)

print("All Card FX Sprite Sheets Created Successfully!")
